"""
FastAPI Backend for Gemini File Search Chat
Supports WebSocket for real-time chat and REST API for file management
"""

from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import os
import time
import uuid
from pathlib import Path
import json

from google import genai
from google.genai import types

# Initialize
app = FastAPI(title="Gemini File Search Chat API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gemini client
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is required")

client = genai.Client(api_key=GEMINI_API_KEY)

# Directory for temporary files
UPLOAD_DIR = Path("/tmp/uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Active WebSocket connections
active_connections: List[WebSocket] = []


# Models
class StoreCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ChatMessage(BaseModel):
    message: str
    store_name: str


class StoreInfo(BaseModel):
    name: str
    display_name: str
    file_count: int


# Helper functions
def get_store_by_name(display_name: str):
    """Find store by name"""
    for store in client.file_search_stores.list().page:
        if store.display_name == display_name:
            return store
    return None


def get_file_count(store_name: str) -> int:
    """Get number of files in store"""
    try:
        docs = list(client.file_search_stores.documents.list(parent=store_name).page)
        return len(docs)
    except:
        return 0


# WebSocket for chat
@app.websocket("/ws/chat/{store_name}")
async def websocket_chat(websocket: WebSocket, store_name: str):
    await websocket.accept()
    active_connections.append(websocket)
    
    try:
        # Check store
        store = get_store_by_name(store_name)
        if not store:
            await websocket.send_json({
                "type": "error",
                "message": f"Store '{store_name}' not found"
            })
            await websocket.close()
            return
        
        # Send welcome message
        await websocket.send_json({
            "type": "system",
            "message": f"Connected to store '{store_name}'. Ask your questions!"
        })
        
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)
            query = message_data.get("message", "")
            
            if not query.strip():
                continue
            
            # Send confirmation
            await websocket.send_json({
                "type": "user",
                "message": query
            })
            
            # Send loading indicator
            await websocket.send_json({
                "type": "loading",
                "message": "Searching for information..."
            })
            
            try:
                # Query Gemini
                response = client.models.generate_content(
                    model="gemini-2.5-pro",
                    contents=query,
                    config=types.GenerateContentConfig(
                        tools=[
                            types.Tool(
                                file_search={'file_search_store_names': [store.name]}
                            )
                        ],
                        system_instruction="""You are a helpful AI assistant.
Answer questions based on the provided documents.
If information is not in the documents, say so honestly.
Format responses nicely with markdown where appropriate."""
                    )
                )
                
                # Send response
                await websocket.send_json({
                    "type": "assistant",
                    "message": response.text
                })
                
            except Exception as e:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Error: {str(e)}"
                })
    
    except WebSocketDisconnect:
        active_connections.remove(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        if websocket in active_connections:
            active_connections.remove(websocket)


# REST API endpoints

@app.get("/")
async def root():
    return {
        "message": "Gemini File Search Chat API",
        "version": "1.0.0",
        "endpoints": {
            "stores": "/api/stores",
            "chat": "ws://localhost:8000/ws/chat/{store_name}"
        }
    }


@app.get("/api/health")
async def health_check():
    """API health check"""
    return {"status": "healthy", "gemini_connected": bool(GEMINI_API_KEY)}


@app.get("/api/stores", response_model=List[StoreInfo])
async def list_stores():
    """Get list of all stores"""
    stores = []
    for store in client.file_search_stores.list().page:
        stores.append(StoreInfo(
            name=store.name,
            display_name=store.display_name,
            file_count=get_file_count(store.name)
        ))
    return stores


@app.post("/api/stores")
async def create_store(store_data: StoreCreate):
    """Create new store"""
    # Check if exists
    existing = get_store_by_name(store_data.name)
    if existing:
        raise HTTPException(status_code=400, detail="Store already exists")
    
    # Create
    store = client.file_search_stores.create(
        config={'display_name': store_data.name}
    )
    
    return {
        "message": "Store created",
        "name": store.name,
        "display_name": store.display_name
    }


@app.delete("/api/stores/{store_name}")
async def delete_store(store_name: str):
    """Delete store"""
    store = get_store_by_name(store_name)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    client.file_search_stores.delete(name=store.name)
    return {"message": "Store deleted"}


@app.get("/api/stores/{store_name}/files")
async def list_files(store_name: str):
    """Get list of files in store"""
    store = get_store_by_name(store_name)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    files = []
    for doc in client.file_search_stores.documents.list(parent=store.name).page:
        files.append({
            "name": doc.display_name,
            "id": doc.name
        })
    
    return {"files": files, "count": len(files)}


@app.post("/api/stores/{store_name}/upload")
async def upload_file(store_name: str, file: UploadFile = File(...)):
    """Upload file to store"""
    store = get_store_by_name(store_name)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    # Check file type
    allowed_extensions = {
        '.pdf', '.docx', '.txt', '.md', '.json',
        '.py', '.js', '.ts', '.jsx', '.tsx'
    }
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Save temporarily
    file_path = UPLOAD_DIR / f"{uuid.uuid4()}_{file.filename}"
    
    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Upload to Gemini
        operation = client.file_search_stores.upload_to_file_search_store(
            file=str(file_path),
            file_search_store_name=store.name,
            config={
                'display_name': file.filename
            }
        )
        
        # Wait for indexing completion
        timeout = 60
        elapsed = 0
        while not operation.done and elapsed < timeout:
            time.sleep(1)
            elapsed += 1
            operation = client.operations.get(operation)
        
        if not operation.done:
            raise HTTPException(status_code=500, detail="Indexing timeout")
        
        return {
            "message": "File uploaded and indexed",
            "filename": file.filename,
            "size": len(content)
        }
    
    finally:
        # Remove temporary file
        if file_path.exists():
            file_path.unlink()


@app.post("/api/stores/{store_name}/upload-multiple")
async def upload_multiple_files(store_name: str, files: List[UploadFile] = File(...)):
    """Upload multiple files"""
    store = get_store_by_name(store_name)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    results = []
    for file in files:
        try:
            file_path = UPLOAD_DIR / f"{uuid.uuid4()}_{file.filename}"
            content = await file.read()
            
            with open(file_path, "wb") as f:
                f.write(content)
            
            operation = client.file_search_stores.upload_to_file_search_store(
                file=str(file_path),
                file_search_store_name=store.name,
                config={'display_name': file.filename}
            )
            
            results.append({
                "filename": file.filename,
                "status": "processing",
                "size": len(content)
            })
            
            if file_path.exists():
                file_path.unlink()
                
        except Exception as e:
            results.append({
                "filename": file.filename,
                "status": "error",
                "error": str(e)
            })
    
    return {"results": results, "total": len(files)}


@app.post("/api/chat")
async def chat_rest(message: ChatMessage):
    """REST endpoint for chat (without WebSocket)"""
    store = get_store_by_name(message.store_name)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=message.message,
            config=types.GenerateContentConfig(
                tools=[
                    types.Tool(
                        file_search={'file_search_store_names': [store.name]}
                    )
                ]
            )
        )
        
        return {
            "message": message.message,
            "response": response.text
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
