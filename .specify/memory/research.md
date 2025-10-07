# Research: Voice Chat Agent

**Date**: 2025-10-06

## Technical Decisions

### 1. FastAPI WebSocket Best Practices

**Decision**: Use `WebSocketEndpoint` class pattern with connection manager

**Rationale**:
- Handles multiple concurrent connections
- Clean separation of connection lifecycle (connect/disconnect/receive)
- Built-in error handling with try/finally blocks

**Implementation**:
```python
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[session_id] = websocket

    def disconnect(self, session_id: str):
        self.active_connections.pop(session_id, None)

    async def send_message(self, session_id: str, message: dict):
        ws = self.active_connections.get(session_id)
        if ws:
            await ws.send_json(message)
```

**Alternatives Considered**:
- Raw WebSocket route - Too low-level, more error-prone
- SocketIO - Unnecessary dependency, WebSocket native is sufficient

---

### 2. OpenAI Streaming API Integration

**Decision**: Use `openai.ChatCompletion.create(stream=True)` with async iteration

**Rationale**:
- Provides real-time typing effect for better UX
- Reduces perceived latency (user sees response start immediately)
- Matches ChatGPT-style interface requirement

**Implementation**:
```python
async for chunk in await openai.ChatCompletion.acreate(
    model="gpt-4",
    messages=messages,
    stream=True
):
    content = chunk.choices[0].delta.get("content", "")
    if content:
        await websocket.send_json({
            "type": "response_chunk",
            "content": content,
            "done": False
        })
```

**Alternatives Considered**:
- Non-streaming API - Slower perceived response time, worse UX
- Server-Sent Events (SSE) - One-way only, can't send user messages easily

---

### 3. Web Speech API Browser Support

**Decision**: Use browser-native Web Speech API, graceful degradation for unsupported browsers

**Rationale**:
- Zero backend infrastructure needed
- Low latency (local processing)
- Simple API: `SpeechRecognition` and `SpeechSynthesis`

**Browser Support**:
- Chrome/Edge: Full support (webkit prefix)
- Safari: Partial support (iOS requires user gesture)
- Firefox: Limited support (needs polyfill or fallback)

**Implementation**:
```typescript
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.continuous = false;
recognition.interimResults = true;

recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  // Send to backend
};

recognition.start();
```

**Fallback Strategy**:
- If Web Speech API unavailable, hide voice button
- Provide clear message: "Voice input requires Chrome/Edge browser"

**Alternatives Considered**:
- OpenAI Whisper API (server-side) - Adds latency, costs money, more complex
- Google Cloud Speech-to-Text - Requires API key, overkill for MVP
- Polyfill libraries - Adds bundle size, still limited coverage

---

### 4. React WebSocket Connection Pattern

**Decision**: Custom `useWebSocket` hook with useEffect for lifecycle management

**Rationale**:
- Encapsulates connection logic
- Handles reconnection automatically
- Integrates with React component lifecycle

**Implementation**:
```typescript
function useWebSocket(sessionId: string) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/${sessionId}`);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 3s
      setTimeout(() => setSocket(null), 3000);
    };

    setSocket(ws);

    return () => ws.close();
  }, [sessionId, socket]);

  return { socket, connected };
}
```

**Alternatives Considered**:
- Raw WebSocket in component - Messy, hard to test
- Third-party library (socket.io-client) - Unnecessary dependency
- Context API for global socket - Overengineered for single connection

---

### 5. File Upload to FastAPI

**Decision**: Use `UploadFile` type with streaming for files >10MB

**Rationale**:
- Prevents loading entire file into RAM
- Built-in validation support (size, MIME type)
- Works with multipart/form-data

**Implementation**:
```python
@app.post("/api/upload")
async def upload_file(file: UploadFile):
    # Validate size
    file.file.seek(0, 2)  # Seek to end
    size = file.file.tell()
    if size > 25 * 1024 * 1024:  # 25MB
        raise HTTPException(413, "File too large")

    # Validate type
    allowed_types = ["text/", "image/", "application/pdf", ...]
    if not any(file.content_type.startswith(t) for t in allowed_types):
        raise HTTPException(400, "Unsupported file type")

    # Stream to disk
    file_path = f"uploads/{uuid4()}_{file.filename}"
    async with aiofiles.open(file_path, 'wb') as f:
        while chunk := await file.read(8192):
            await f.write(chunk)

    return {"file_id": str(uuid4()), "filename": file.filename}
```

**Alternatives Considered**:
- Base64 encoding in JSON - Wasteful, 33% overhead, slow
- Direct binary WebSocket - Complex protocol, not worth it
- Cloud storage (S3) - Overkill for MVP, adds latency and cost

---

## Summary

All technical decisions favor **simplicity and browser-native APIs** where possible:
- WebSocket (native)
- Web Speech API (native)
- FastAPI built-in features (no extra libraries)
- React hooks (no state management library)

Complexity is only added where unavoidable (OpenAI streaming, file upload validation).

**Status**: ✅ All research complete, no unknowns remain
