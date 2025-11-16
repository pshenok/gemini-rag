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
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'loading') {
        setIsLoading(true);
      } else {
        setIsLoading(false);
        setMessages(prev => [...prev, {
          type: data.type,
          content: data.message,
          timestamp: new Date()
        }]);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
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

    wsRef.current.send(JSON.stringify({
      message: inputMessage
    }));

    setInputMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const uploadFiles = async (fileList) => {
    if (!selectedStore || !fileList.length) return;

    const formData = new FormData();
    Array.from(fileList).forEach(file => {
      formData.append('files', file);
    });

    try {
      setIsLoading(true);
      const response = await fetch(
        `${API_URL}/api/stores/${selectedStore.display_name}/upload-multiple`,
        {
          method: 'POST',
          body: formData
        }
      );

      if (response.ok) {
        loadFiles(selectedStore.display_name);
        setShowUpload(false);
        setMessages(prev => [...prev, {
          type: 'system',
          content: `Files uploaded and indexing...`,
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setIsLoading(false);
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
                >
                  Select Files
                </button>
                <div className="files-info">
                  <p>Supported formats: PDF, DOCX, TXT, MD, JSON, code</p>
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
                  <h3>👋 Hi! I'm ready to answer questions about your documents.</h3>
                  <p>Upload files and start asking questions!</p>
                  <div className="example-queries">
                    <p>Example questions:</p>
                    <ul>
                      <li>What does it say about security?</li>
                      <li>Where is the database configuration?</li>
                      <li>What API endpoints are available?</li>
                      <li>How to deploy the application?</li>
                    </ul>
                  </div>
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
                placeholder="Ask a question about your documents..."
                disabled={!isConnected}
                rows={2}
              />
              <button 
                onClick={sendMessage}
                disabled={!isConnected || !inputMessage.trim()}
                className="btn-send"
              >
                Send ✈️
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
