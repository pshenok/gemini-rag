# Gemini RAG Chat Application

A chat application using Google's Gemini API with FileSearch for Retrieval-Augmented Generation (RAG).

## Problem Fixed: FileSearchTool Error

### The Error
```
Error: module 'google.genai.types' has no attribute 'FileSearchTool'
```

### Root Cause
The class `FileSearchTool` **does not exist** in the Google GenAI SDK. This is a common mistake when trying to use the FileSearch feature.

### The Fix

**INCORRECT** ❌
```python
# This will cause an error
tools=[types.FileSearchTool(...)]  # FileSearchTool doesn't exist!
```

**CORRECT** ✅
```python
from google import genai
from google.genai import types

# Use types.FileSearch wrapped in types.Tool
tools=[
    types.Tool(
        file_search=types.FileSearch(
            file_search_store_names=[store_name]
        )
    )
]
```

### Key Points
1. Use `types.FileSearch` (not `FileSearchTool`)
2. Wrap it in `types.Tool` object
3. Use the `file_search` parameter (lowercase with underscore)
4. Pass it in the `tools` list within `GenerateContentConfig`

## Installation

```bash
# Install the NEW Google GenAI SDK
pip install google-genai

# Or install from requirements.txt
pip install -r requirements.txt
```

**Important:** Do NOT use `google-generativeai` (the legacy SDK). It will be deprecated in August 2025.

## Setup

1. Get your Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

2. Set the environment variable:
```bash
export GEMINI_API_KEY='your-api-key-here'
```

## Usage

### Basic Chat
```bash
python chat.py
```

### Complete Example

```python
from google import genai
from google.genai import types
import os

# Initialize client
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

# Create a file search store
file_search_store = client.file_search_stores.create(
    config={'display_name': 'my_documents'}
)

# Upload files to the store
client.file_search_stores.upload_to_file_search_store(
    file='document.pdf',
    file_search_store_name=file_search_store.name
)

# Chat with RAG
response = client.models.generate_content(
    model="gemini-2.0-flash-exp",
    contents="What does the document say about X?",
    config=types.GenerateContentConfig(
        tools=[
            types.Tool(
                file_search=types.FileSearch(
                    file_search_store_names=[file_search_store.name]
                )
            )
        ]
    )
)

print(response.text)
```

## File Search Store Management

### Create a Store
```python
store = client.file_search_stores.create(
    config={'display_name': 'my_store'}
)
print(f"Store created: {store.name}")
```

### Upload Files
```python
# Supported formats: PDF, TXT, HTML, DOCX, and more
client.file_search_stores.upload_to_file_search_store(
    file='path/to/file.pdf',
    file_search_store_name=store.name
)
```

### List Stores
```python
stores = client.file_search_stores.list()
for store in stores:
    print(f"Store: {store.display_name} - {store.name}")
```

### Delete a Store
```python
client.file_search_stores.delete(name=store.name)
```

## Features

- **Managed RAG**: Google handles chunking, embedding, and indexing
- **Free Storage**: No charge for storage and query-time embedding
- **Scalable**: Built-in vector database and retrieval
- **Multiple Formats**: Supports PDF, TXT, HTML, DOCX, and more

## Pricing

- **Storage & Query Embeddings**: Free
- **Indexing**: $0.15 per 1 million tokens (one-time cost when uploading)
- **Model Usage**: Standard Gemini API pricing

## Troubleshooting

### Error: No module named 'google.genai'
```bash
pip install google-genai
```

### Error: GEMINI_API_KEY not set
```bash
export GEMINI_API_KEY='your-api-key'
```

### Error: FileSearchTool not found
See the "Problem Fixed" section above. Use `types.FileSearch` instead.

## Resources

- [Google GenAI SDK Documentation](https://googleapis.github.io/python-genai/)
- [File Search Documentation](https://ai.google.dev/gemini-api/docs/file-search)
- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)

## Migration from Legacy SDK

If you're using the old `google-generativeai` package:

**Old SDK** (Deprecated)
```python
import google.generativeai as genai
```

**New SDK** (Current)
```python
from google import genai
from google.genai import types
```

The new SDK is the official, actively maintained version and will be supported long-term.
