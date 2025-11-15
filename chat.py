#!/usr/bin/env python3
"""
Gemini RAG Chat Application with FileSearch

This demonstrates the CORRECT way to use FileSearch with Google GenAI SDK.

Common Error: module 'google.genai.types' has no attribute 'FileSearchTool'
Fix: Use types.FileSearch (not FileSearchTool) wrapped in types.Tool
"""

import os
from google import genai
from google.genai import types


def create_file_search_store(client, store_name="my_rag_store"):
    """Create a file search store for RAG."""
    print(f"Creating file search store: {store_name}")

    file_search_store = client.file_search_stores.create(
        config={'display_name': store_name}
    )

    print(f"Created store: {file_search_store.name}")
    return file_search_store


def upload_file_to_store(client, file_path, store_name):
    """Upload a file to the file search store."""
    print(f"Uploading {file_path} to store...")

    operation = client.file_search_stores.upload_to_file_search_store(
        file=file_path,
        file_search_store_name=store_name
    )

    print(f"File uploaded successfully")
    return operation


def chat_with_rag(client, store_name, query):
    """
    Chat with RAG using FileSearch.

    CORRECT USAGE:
    - Use types.FileSearch (NOT FileSearchTool)
    - Wrap it in types.Tool
    - Pass it in the tools list
    """
    print(f"\nQuery: {query}")

    response = client.models.generate_content(
        model="gemini-2.0-flash-exp",
        contents=query,
        config=types.GenerateContentConfig(
            tools=[
                # CORRECT: types.Tool with file_search parameter
                types.Tool(
                    file_search=types.FileSearch(
                        file_search_store_names=[store_name]
                    )
                )
            ]
        )
    )

    return response


def main():
    """Main chat application."""
    # Initialize client
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable not set")
        print("Set it with: export GEMINI_API_KEY='your-api-key'")
        return

    client = genai.Client(api_key=api_key)

    print("=" * 60)
    print("Gemini RAG Chat with FileSearch")
    print("=" * 60)

    # Example usage
    # Uncomment below to create a store and upload files
    """
    # Create file search store
    store = create_file_search_store(client)

    # Upload files to the store
    upload_file_to_store(client, "document.pdf", store.name)

    # Save store name for later use
    store_name = store.name
    """

    # For demo purposes, use an existing store
    # Replace with your actual store name
    store_name = input("Enter your file search store name (or press Enter to skip): ").strip()

    if not store_name:
        print("\nNo store provided. Showing example code structure only.")
        print("\nCORRECT usage example:")
        print("  types.Tool(")
        print("      file_search=types.FileSearch(")
        print("          file_search_store_names=[store_name]")
        print("      )")
        print("  )")
        print("\nINCORRECT (causes error):")
        print("  types.FileSearchTool(...)  # This doesn't exist!")
        return

    # Chat loop
    print("\nStarting chat. Type 'quit' to exit.")
    while True:
        query = input("\nYou: ").strip()

        if query.lower() in ['quit', 'exit', 'q']:
            print("Goodbye!")
            break

        if not query:
            continue

        try:
            response = chat_with_rag(client, store_name, query)
            print(f"\nAssistant: {response.text}")
        except Exception as e:
            print(f"\nError: {e}")
            print("\nTroubleshooting:")
            print("1. Make sure your store name is correct")
            print("2. Verify your API key is valid")
            print("3. Check that files were uploaded to the store")


if __name__ == "__main__":
    main()
