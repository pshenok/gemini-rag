import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const API_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000';

function App() {
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [connectionError, setConnectionError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);

  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadStores();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadStores = async () => {
    try {
      const response = await fetch(`${API_URL}/api/stores`);
      const data = await response.json();
      setStores(data);
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  const createStore = async () => {
    if (!newStoreName.trim()) return;
    
    try {
      await fetch(`${API_URL}/api/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStoreName })
      });
      
      setNewStoreName('');
      loadStores();
    } catch (error) {
      console.error('Error creating store:', error);
    }
  };

  const connectToStore = (store) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setSelectedStore(store);
    setMessages([]);
    setIsConnected(false);
    loadFiles(store.display_name);

    const ws = new WebSocket(`${WS_URL}/ws/chat/${store.display_name}`);
    
    ws.onopen = () => {
      setIsConnected(true);
      setConnectionError(null);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Skip user messages (already added immediately on send)
      if (data.type === 'user') {
        return;
      }

      // Skip loading messages (already handled in sendMessage)
      if (data.type === 'loading') {
        return;
      }

      // Add assistant, system, or error messages
      setIsLoading(false);
      setMessages(prev => [...prev, {
        type: data.type,
        content: data.message,
        timestamp: new Date()
      }]);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
      setIsLoading(false);
      setConnectionError('Connection error occurred. Please try reconnecting.');
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsLoading(false);
      if (!connectionError) {
        setConnectionError('Connection closed. Click reconnect to continue.');
      }
    };

    wsRef.current = ws;
  };

  const loadFiles = async (storeName) => {
    try {
      const response = await fetch(`${API_URL}/api/stores/${storeName}/files`);
      const data = await response.json();
      setFiles(data.files || []);
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  const sendMessage = () => {
    if (!inputMessage.trim() || !isConnected) return;

    // Add user message immediately for instant feedback
    const userMessage = {
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    // Send to server
    wsRef.current.send(JSON.stringify({
      message: inputMessage
    }));

    // Clear input and show loading state
    setInputMessage('');
    setIsLoading(true);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const uploadFiles = async (fileList) => {
    if (!selectedStore || !fileList.length) return;

    const fileArray = Array.from(fileList);
    const totalSize = fileArray.reduce((sum, file) => sum + file.size, 0);
    const maxSize = 50 * 1024 * 1024; // 50MB

    // Validate file size
    if (totalSize > maxSize) {
      setMessages(prev => [...prev, {
        type: 'error',
        content: `Total file size (${(totalSize / 1024 / 1024).toFixed(2)}MB) exceeds 50MB limit.`,
        timestamp: new Date()
      }]);
      return;
    }

    const formData = new FormData();
    fileArray.forEach(file => {
      formData.append('files', file);
    });

    try {
      setUploadProgress(`Uploading ${fileArray.length} file(s)...`);
      const response = await fetch(
        `${API_URL}/api/stores/${selectedStore.display_name}/upload-multiple`,
        {
          method: 'POST',
          body: formData
        }
      );

      if (response.ok) {
        setUploadProgress('Processing and indexing files...');
        await loadFiles(selectedStore.display_name);
        setShowUpload(false);
        setMessages(prev => [...prev, {
          type: 'system',
          content: `✅ Successfully uploaded ${fileArray.length} file(s). Files are now indexed and ready for search.`,
          timestamp: new Date()
        }]);
        setUploadProgress(null);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      setMessages(prev => [...prev, {
        type: 'error',
        content: `❌ Failed to upload files. Please try again.`,
        timestamp: new Date()
      }]);
      setUploadProgress(null);
    }
  };

  const formatMessage = (content) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>💬 Gemini Chat</h2>
        </div>

        <div className="new-store">
          <input
            type="text"
            placeholder="New store"
            value={newStoreName}
            onChange={(e) => setNewStoreName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && createStore()}
          />
          <button onClick={createStore}>➕</button>
        </div>

        <div className="stores-list">
          <h3>Stores</h3>
          {stores.map(store => (
            <div
              key={store.name}
              className={`store-item ${selectedStore?.name === store.name ? 'active' : ''}`}
              onClick={() => connectToStore(store)}
            >
              <div className="store-name">📦 {store.display_name}</div>
              <div className="store-files">{store.file_count} files</div>
            </div>
          ))}
        </div>
      </div>

      <div className="main-content">
        {selectedStore ? (
          <>
            <div className="chat-header">
              <div className="header-left">
                <h2>{selectedStore.display_name}</h2>
                <span className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
                  {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                </span>
                {!isConnected && connectionError && (
                  <button
                    className="btn-reconnect"
                    onClick={() => connectToStore(selectedStore)}
                    style={{ marginLeft: '10px', padding: '5px 10px', fontSize: '12px' }}
                  >
                    🔄 Reconnect
                  </button>
                )}
              </div>
              <div className="header-right">
                <button
                  className="btn-secondary"
                  onClick={() => setShowUpload(!showUpload)}
                >
                  📎 Upload Files
                </button>
              </div>
            </div>

            {connectionError && (
              <div className="error-banner" style={{
                background: '#ffebee',
                color: '#c62828',
                padding: '12px 20px',
                borderLeft: '4px solid #c62828',
                marginBottom: '10px'
              }}>
                ⚠️ {connectionError}
              </div>
            )}

            {showUpload && (
              <div className="upload-section">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt,.md,.json,.py,.js,.ts,.jsx,.tsx"
                  onChange={(e) => uploadFiles(e.target.files)}
                  style={{ display: 'none' }}
                />
                <button
                  className="btn-upload"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!!uploadProgress}
                >
                  {uploadProgress ? uploadProgress : 'Select Files'}
                </button>
                {uploadProgress && (
                  <div style={{
                    marginTop: '10px',
                    padding: '10px',
                    background: '#e3f2fd',
                    borderRadius: '5px',
                    color: '#1976d2'
                  }}>
                    ⏳ {uploadProgress}
                  </div>
                )}
                <div className="files-info">
                  <p>Supported formats: PDF, DOCX, TXT, MD, JSON, code (max 50MB total)</p>
                  <div className="current-files">
                    <strong>Current files ({files.length}):</strong>
                    <ul>
                      {files.slice(0, 5).map((file, idx) => (
                        <li key={idx}>{file.name}</li>
                      ))}
                      {files.length > 5 && <li>...and {files.length - 5} more</li>}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="messages-container">
              {messages.length === 0 && (
                <div className="welcome-message">
                  <h3>👋 Welcome to Gemini File Search!</h3>
                  <p>I'm your AI assistant, ready to help you explore and understand your documents.</p>

                  {files.length === 0 ? (
                    <div style={{ marginTop: '20px' }}>
                      <p><strong>🚀 Get Started:</strong></p>
                      <button
                        onClick={() => setShowUpload(true)}
                        style={{
                          padding: '12px 24px',
                          background: '#3498db',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '16px',
                          marginTop: '10px'
                        }}
                      >
                        📎 Upload Your First Document
                      </button>
                    </div>
                  ) : (
                    <div className="example-queries">
                      <p><strong>💡 Try asking:</strong></p>
                      <ul>
                        <li>"What are the main topics in these documents?"</li>
                        <li>"Summarize the key points about [topic]"</li>
                        <li>"Find information about [specific subject]"</li>
                        <li>"What does it say about [keyword]?"</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {messages.map((msg, idx) => (
                <div key={idx} className={`message ${msg.type}`}>
                  <div className="message-content">
                    {msg.type === 'user' && <strong>You:</strong>}
                    {msg.type === 'assistant' && <strong>🤖 AI:</strong>}
                    {msg.type === 'system' && <strong>ℹ️ System:</strong>}
                    <div 
                      dangerouslySetInnerHTML={{ 
                        __html: formatMessage(msg.content) 
                      }}
                    />
                  </div>
                  <div className="message-time">
                    {msg.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="message assistant loading">
                  <div className="message-content">
                    <strong>🤖 AI:</strong>
                    <span style={{ marginLeft: '8px', color: '#7f8c8d', fontSize: '14px' }}>
                      is typing...
                    </span>
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="input-container">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isLoading ? "AI is responding..." : "Ask a question about your documents..."}
                disabled={!isConnected || isLoading}
                rows={2}
              />
              <button
                onClick={sendMessage}
                disabled={!isConnected || !inputMessage.trim() || isLoading}
                className="btn-send"
              >
                {isLoading ? '⏳' : 'Send ✈️'}
              </button>
            </div>
          </>
        ) : (
          <div className="no-store-selected">
            <h2>Select a Store</h2>
            <p>Select an existing store or create a new one</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
