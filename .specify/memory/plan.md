# Implementation Plan: Voice Chat Agent

**Date**: 2025-10-06 | **Spec**: [.specify/memory/spec.md](.specify/memory/spec.md)

## Summary

Build a ChatGPT-style web chat interface with real-time messaging, voice input/output, and file attachments. Backend uses FastAPI + WebSocket + OpenAI API. Frontend uses React + TypeScript + TailwindCSS. SQLite for dev, PostgreSQL for prod.

## Technical Stack

**Language/Version**: Python 3.11+ (backend), TypeScript 5.0+ (frontend), Node.js 18+
**Backend**: FastAPI, uvicorn, WebSocket, OpenAI Python SDK, SQLAlchemy
**Frontend**: React 18, TypeScript, TailwindCSS, WebSocket API, Web Speech API
**Storage**: SQLite (dev), PostgreSQL (prod)
**Testing**: pytest (backend), Vitest + React Testing Library (frontend)
**Performance Goals**: <100ms message latency, <500ms voice transcription start
**Constraints**: <200ms p95 for AI responses, 25MB max file size
**Scale**: 100 concurrent users target

## Constitution Check

✅ **Simplicity First**: Text chat is MVP. Voice and files are layered on top.
✅ **Never Break User Experience**: WebSocket handles disconnections. Progressive enhancement for voice.
✅ **Real-time First**: WebSocket is primary transport. No polling.
✅ **Observability**: All errors logged with context. State transitions tracked.
✅ **Progressive Enhancement**: Core text chat works without voice/file features.

**Complexity Justification**: WebSocket + OpenAI streaming required for real-time UX. No simpler alternative exists.

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app + WebSocket endpoint
│   ├── models.py            # SQLAlchemy models (Message, Conversation, Attachment)
│   ├── database.py          # DB connection and session management
│   ├── services/
│   │   ├── openai_service.py  # OpenAI API integration (streaming chat)
│   │   ├── file_service.py    # File upload/storage handling
│   │   └── voice_service.py   # Voice transcription (optional Whisper)
│   └── schemas.py           # Pydantic models for validation
├── tests/
│   ├── test_api.py          # API endpoint tests
│   ├── test_websocket.py    # WebSocket connection tests
│   └── test_services.py     # Service layer unit tests
├── .env                     # Environment variables (OPENAI_API_KEY)
├── requirements.txt         # Python dependencies
└── README.md                # Backend setup instructions

frontend/
├── src/
│   ├── App.tsx              # Main app component
│   ├── components/
│   │   ├── ChatInterface.tsx    # Main chat UI container
│   │   ├── MessageList.tsx      # Message display area
│   │   ├── MessageInput.tsx     # Text input + buttons (send/mic/attach)
│   │   ├── VoiceRecorder.tsx    # Voice recording UI + Web Speech API
│   │   ├── FileUploader.tsx     # File attachment UI
│   │   └── ConversationList.tsx # Sidebar for saved conversations
│   ├── services/
│   │   ├── websocket.ts     # WebSocket connection manager
│   │   ├── api.ts           # HTTP API client (file upload, history)
│   │   ├── voice.ts         # Web Speech API wrapper
│   │   └── tts.ts           # Text-to-speech service
│   ├── types/
│   │   └── index.ts         # TypeScript interfaces (Message, Conversation, etc.)
│   ├── hooks/
│   │   ├── useWebSocket.ts  # WebSocket connection hook
│   │   ├── useVoice.ts      # Voice recording hook
│   │   └── useTTS.ts        # Text-to-speech hook
│   └── main.tsx             # React entry point
├── tests/
│   ├── ChatInterface.test.tsx
│   ├── WebSocket.test.ts
│   └── Voice.test.ts
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
└── README.md                # Frontend setup instructions

.specify/                     # Spec-kit documentation
└── memory/
    ├── constitution.md      # Project principles (already created)
    ├── spec.md              # Feature specification (already created)
    ├── plan.md              # This file
    ├── research.md          # Phase 0 output
    ├── data-model.md        # Phase 1 output
    └── contracts/           # API contracts (OpenAPI)
```

**Structure Decision**: Web application (frontend + backend). Frontend is SPA served separately from backend API.

---

## Phase 0: Research & Setup

**No unknowns remain** - all decisions made in spec. This phase creates minimal research doc + setup instructions.

### Research Tasks
1. ✅ **FastAPI WebSocket best practices** - Use `WebSocketEndpoint` class, handle disconnections with try/finally
2. ✅ **OpenAI streaming API** - Use `openai.ChatCompletion.create(stream=True)` and yield chunks over WebSocket
3. ✅ **Web Speech API browser support** - Chrome/Edge have full support, Safari partial, Firefox needs polyfill
4. ✅ **React WebSocket patterns** - Use custom hook with useEffect for connection lifecycle
5. ✅ **File upload to FastAPI** - Use `UploadFile` type with streaming for large files

**Output**: [research.md](.specify/memory/research.md) documenting these decisions

---

## Phase 1: Design & Contracts

### Data Model ([data-model.md](.specify/memory/data-model.md))

**Conversation**
- `id`: UUID (PK)
- `created_at`: DateTime
- `session_id`: String (browser session, for anonymous users)
- `title`: String (first message preview, nullable)

**Message**
- `id`: UUID (PK)
- `conversation_id`: UUID (FK → Conversation)
- `role`: Enum('user', 'assistant')
- `content`: Text
- `created_at`: DateTime
- `metadata`: JSON (voice=true/false, file_refs=[])

**Attachment**
- `id`: UUID (PK)
- `message_id`: UUID (FK → Message)
- `filename`: String
- `file_size`: Integer (bytes)
- `mime_type`: String
- `storage_path`: String (local file path or S3 key)
- `created_at`: DateTime

**Relationships**:
- Conversation → Messages (one-to-many)
- Message → Attachments (one-to-many)

### API Contracts ([contracts/api.yaml](.specify/memory/contracts/api.yaml))

**WebSocket Endpoint**: `ws://localhost:8000/ws/{session_id}`

Messages (JSON):
```json
// Client → Server (send message)
{
  "type": "message",
  "content": "user question",
  "metadata": {
    "voice": false,
    "attachments": ["file_uuid_1", "file_uuid_2"]
  }
}

// Server → Client (AI response chunk)
{
  "type": "response_chunk",
  "content": "partial response text",
  "done": false
}

// Server → Client (response complete)
{
  "type": "response_complete",
  "message_id": "uuid"
}

// Server → Client (error)
{
  "type": "error",
  "message": "Error description"
}
```

**HTTP REST Endpoints**:

`POST /api/upload` - Upload file
- Request: multipart/form-data with file
- Response: `{ "file_id": "uuid", "filename": "...", "size": 12345 }`

`GET /api/conversations` - List conversations
- Query: `?session_id=xyz`
- Response: `[{ "id": "uuid", "title": "...", "created_at": "..." }]`

`GET /api/conversations/{id}/messages` - Get conversation history
- Response: `[{ "id": "uuid", "role": "user", "content": "...", "attachments": [...] }]`

### Contract Tests (Phase 1)

**tests/test_api.py**:
- `test_upload_file_success()` - POST /api/upload with valid file
- `test_upload_file_too_large()` - POST /api/upload with >25MB file (expect 413)
- `test_upload_unsupported_type()` - POST /api/upload with .exe file (expect 400)
- `test_get_conversations()` - GET /api/conversations (expect 200 + array)

**tests/test_websocket.py**:
- `test_websocket_connect()` - Connect to /ws/{session_id} (expect success)
- `test_send_message()` - Send message → receive response chunks → receive complete
- `test_websocket_disconnect_reconnect()` - Disconnect mid-response → reconnect → resume

All tests MUST FAIL initially (no implementation yet).

### Quickstart ([quickstart.md](.specify/memory/quickstart.md))

**Backend Setup**:
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend Setup**:
```bash
cd frontend
npm install
npm run dev
```

**Environment**:
```bash
# backend/.env
OPENAI_API_KEY=sk-...
DATABASE_URL=sqlite:///./chat.db
```

---

## Phase 2: Task Generation (NOT executed by /plan)

This phase is handled by the `/tasks` command. It will create [tasks.md](.specify/memory/tasks.md) with:

1. **Backend Tasks**:
   - Setup FastAPI project structure
   - Implement SQLAlchemy models (Conversation, Message, Attachment)
   - Implement WebSocket endpoint with message handling
   - Integrate OpenAI streaming API
   - Implement file upload endpoint
   - Implement conversation history endpoints
   - Write API contract tests
   - Add error logging and observability

2. **Frontend Tasks**:
   - Setup Vite + React + TypeScript + TailwindCSS
   - Implement ChatInterface component (UI layout)
   - Implement WebSocket connection hook
   - Implement MessageList with streaming display
   - Implement MessageInput with send button
   - Implement VoiceRecorder with Web Speech API
   - Implement FileUploader with progress indicator
   - Implement ConversationList sidebar
   - Implement text-to-speech for voice responses
   - Write component unit tests

3. **Integration Tasks**:
   - Connect frontend WebSocket to backend
   - Test file upload flow end-to-end
   - Test voice input → transcription → send flow
   - Test conversation persistence and loading

---

## Progress Tracking

- [x] Phase 0: Research complete (no unknowns)
- [x] Phase 1: Data model defined
- [x] Phase 1: API contracts defined
- [x] Phase 1: Contract tests specified
- [x] Phase 1: Quickstart guide written
- [ ] Phase 2: Tasks generated (awaiting /tasks command)
- [ ] Phase 3: Implementation (awaiting /implement command)
- [ ] Phase 4: Testing & validation

---

## Complexity Tracking

**Unavoidable Complexity**:
1. WebSocket bi-directional communication - Required for real-time chat (constitutional requirement)
2. OpenAI streaming API - Required for typing effect during AI responses
3. Web Speech API - Browser native, simplest voice solution (no server-side processing needed)
4. File upload with validation - Required by spec (25MB limit, type checking)

**Avoided Complexity**:
1. ❌ No authentication system (anonymous users via session ID)
2. ❌ No user accounts or profiles
3. ❌ No complex state management (React hooks sufficient)
4. ❌ No server-side voice transcription (use browser native first)
5. ❌ No CDN or cloud storage (local files for MVP)

---

## Risk Mitigation

1. **WebSocket disconnections**: Auto-reconnect logic in frontend hook, queue messages while offline
2. **OpenAI API failures**: Catch errors, display user-friendly message, allow retry
3. **Browser Speech API support**: Graceful degradation - hide voice button if unsupported
4. **Large file uploads**: Streaming upload, progress indicator, enforce size limit
5. **Database migrations**: Use Alembic for schema versioning (add later if needed)

---

**Status**: ✅ Plan Complete - Ready for `/tasks` command

**Next Step**: Run `/tasks` to generate task list from this plan
