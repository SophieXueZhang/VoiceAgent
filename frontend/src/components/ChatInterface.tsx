import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useVoiceRecognition } from '../hooks/useVoice';
import type { Message } from '../types';

// Generate simple session ID (in real app, use UUID library)
const SESSION_ID = 'session_' + Math.random().toString(36).substring(2, 11);

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Array<{id: string, name: string, size: number}>>([]);
  const [isUploading, setIsUploading] = useState(false);

  const { connected, sendMessage, lastMessage } = useWebSocket(SESSION_ID);
  const { isRecording, transcript, isSupported, toggleRecording, clearTranscript } = useVoiceRecognition();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'connection_ack':
        console.log('Connected to session:', lastMessage.session_id);
        break;

      case 'response_chunk':
        setIsTyping(true);
        setCurrentResponse(prev => prev + (lastMessage.content || ''));
        break;

      case 'response_complete':
        // Add completed assistant message using callback to get latest state
        setCurrentResponse(latestResponse => {
          if (latestResponse) {
            const newMessage: Message = {
              id: lastMessage.message_id || '',
              conversation_id: '',
              role: 'assistant',
              content: latestResponse,
              created_at: new Date().toISOString(),
            };
            setMessages(prev => [...prev, newMessage]);
            setIsTyping(false);
            return ''; // Clear response
          }
          return latestResponse;
        });
        break;

      case 'error':
        console.error('Error:', lastMessage.message);
        setIsTyping(false);
        setCurrentResponse('');
        break;
    }
  }, [lastMessage]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentResponse]);

  // Define handleSendVoice before using it in useEffect
  const handleSendVoice = useCallback((voiceInput: string) => {
    if (!voiceInput.trim() || !connected) return;

    // Add user message to UI
    const userMessage: Message = {
      id: 'temp_' + Date.now(),
      conversation_id: '',
      role: 'user',
      content: voiceInput,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Send to backend with voice metadata
    sendMessage({
      type: 'message',
      content: voiceInput,
      metadata: { voice: true },
    });

    setInput('');
  }, [connected, sendMessage]);

  // Update input when voice transcript changes
  useEffect(() => {
    if (transcript && !isRecording) {
      // Recording stopped, set input and auto-send
      setInput(transcript);
      clearTranscript();
      // Auto-send after short delay to allow user to see transcript
      setTimeout(() => {
        handleSendVoice(transcript);
      }, 500);
    } else if (transcript && isRecording) {
      // Still recording, show interim results
      setInput(transcript);
    }
  }, [transcript, isRecording, clearTranscript, handleSendVoice]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size
    if (file.size > 25 * 1024 * 1024) {
      alert('File size exceeds 25MB limit');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upload failed');
      }

      const result = await response.json();
      setUploadedFiles(prev => [...prev, {
        id: result.file_id,
        name: result.filename,
        size: result.size
      }]);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSend = () => {
    if (!input.trim() || !connected) return;

    // Add user message to UI
    const userMessage: Message = {
      id: 'temp_' + Date.now(),
      conversation_id: '',
      role: 'user',
      content: input,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Send to backend with attachments
    sendMessage({
      type: 'message',
      content: input,
      metadata: {
        voice: false,
        attachments: uploadedFiles.map(f => f.id)
      },
    });

    setInput('');
    setUploadedFiles([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-semibold">Voice Chat Agent</h1>
        <p className="text-sm text-gray-500">
          {connected ? '🟢 Connected' : '🔴 Disconnected'}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-2xl px-4 py-2 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-900 border'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && currentResponse && (
          <div className="flex justify-start">
            <div className="max-w-2xl px-4 py-2 rounded-lg bg-white text-gray-900 border">
              <p className="whitespace-pre-wrap">{currentResponse}</p>
              <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1"></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="bg-white border-t p-4">
        <div className="max-w-4xl mx-auto">
          {/* File previews */}
          {uploadedFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {uploadedFiles.map((file) => (
                <div key={file.id} className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-lg text-sm">
                  <span className="text-blue-700">{file.name}</span>
                  <button
                    onClick={() => setUploadedFiles(prev => prev.filter(f => f.id !== file.id))}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              accept="text/*,image/*,.pdf,.docx,.js,.py,.java,.md"
            />

            {/* Attachment Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || !connected}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50"
              title="Attach file"
            >
              {isUploading ? (
                <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              )}
            </button>

          {/* Text Input */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            className="flex-1 resize-none border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={1}
            disabled={!connected}
          />

          {/* Microphone Button */}
          {isSupported ? (
            <button
              onClick={toggleRecording}
              className={`p-2 rounded-lg ${
                isRecording
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title={isRecording ? "Stop recording" : "Voice input"}
              disabled={!connected}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          ) : (
            <button
              className="p-2 text-gray-300 cursor-not-allowed"
              title="Voice input not supported in this browser (try Chrome/Edge)"
              disabled
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          )}

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || !connected}
            className="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
