# 💬 Gemini File Search Chat

Full-stack application for working with documents through AI using Gemini File Search API.

## ✨ Features

- 🤖 AI chat with documents
- 📁 Store management
- 📤 File upload (PDF, DOCX, TXT, MD, JSON, code)
- ⚡ Real-time chat via WebSocket
- 🎨 Modern React UI
- 🔍 Semantic search
- 💰 Super cheap (pay only for indexing)

## 🚀 Quick Start

### Option 1: Docker (recommended)

```bash
# 1. Get API key
# https://aistudio.google.com/apikey

# 2. Set environment variable
export GEMINI_API_KEY='your-key'

# 3. Run
docker-compose -f docker-compose-fullstack.yml up --build
```

Done! Open http://localhost:3000

### Option 2: Separate launch

**Backend:**
```bash
cd backend
pip install -r requirements.txt
export GEMINI_API_KEY='your-key'
uvicorn api:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm start
```

## 📖 How to Use

1. Create a store in the left panel
2. Upload files (PDF, DOCX, TXT, code)
3. Ask questions in chat!

## 🎯 Example Questions

- "How to configure authentication?"
- "Where are the API endpoints?"
- "What does it say about security?"
- "Show examples of Redis usage"

## 💰 Pricing

- Indexing: $0.15 per 1M tokens (one-time)
- Storage: FREE ✨
- Queries: FREE ✨
- 1000 files ≈ $0.75 one-time!

## 📚 Technologies

- Backend: FastAPI + WebSocket + Gemini API
- Frontend: React 18
- Infrastructure: Docker + Docker Compose

## 🔧 API

```
GET    /api/stores                       # List stores
POST   /api/stores                       # Create
POST   /api/stores/{name}/upload         # Upload file
WS     /ws/chat/{store_name}             # WebSocket chat
```

## 📝 License

MIT License

---

⭐ Made with ❤️ for working with documents through AI
