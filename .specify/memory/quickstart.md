# Quickstart Guide: Voice Chat Agent

**Last Updated**: 2025-10-06

This guide gets you running the Voice Chat Agent in under 5 minutes.

---

## Prerequisites

**Required**:
- Python 3.11 or higher
- Node.js 18 or higher
- OpenAI API key (already in `.env`)

**Verify**:
```bash
python --version  # Should be 3.11+
node --version    # Should be 18+
npm --version
```

---

## Backend Setup

### 1. Navigate to backend directory
```bash
cd backend
```

### 2. Create Python virtual environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

**Expected dependencies** (will be in requirements.txt):
```
fastapi==0.104.1
uvicorn[standard]==0.24.0
websockets==12.0
openai==1.3.5
sqlalchemy==2.0.23
aiofiles==23.2.1
python-multipart==0.0.6
python-dotenv==1.0.0
```

### 4. Set up environment variables
```bash
# Already exists in project root, verify it's correct
cat ../.env
```

Should contain:
```
OPENAI_API_KEY=sk-proj-...
DATABASE_URL=sqlite:///./chat.db
```

### 5. Initialize database
```bash
# Run database migrations (will be created during implementation)
python -m app.database init
```

### 6. Start backend server
```bash
uvicorn app.main:app --reload --port 8000
```

**Expected output**:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

**Verify backend**:
Open http://localhost:8000/docs in browser → Should see FastAPI Swagger UI

---

## Frontend Setup

### 1. Navigate to frontend directory (new terminal)
```bash
cd frontend
```

### 2. Install dependencies
```bash
npm install
```

**Expected dependencies** (will be in package.json):
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.3.6",
    "typescript": "^5.3.3",
    "vite": "^5.0.8",
    "vitest": "^1.0.4"
  }
}
```

### 3. Start development server
```bash
npm run dev
```

**Expected output**:
```
  VITE v5.0.8  ready in 523 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

**Verify frontend**:
Open http://localhost:5173 in browser → Should see chat interface

---

## Test the Application

### 1. Open the app
Navigate to http://localhost:5173

### 2. Send a text message
Type "Hello" in the input field and click Send → AI should respond

### 3. Test voice input (Chrome/Edge only)
1. Click the microphone button
2. Say "What is Python?"
3. See transcription appear
4. Click send or microphone again
5. AI response should be read aloud

### 4. Test file upload
1. Click the attachment button
2. Select an image or text file (<25MB)
3. Type "What's in this file?"
4. Send → AI should analyze the file

---

## Project Structure Overview

```
.
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── models.py            # Database models
│   │   ├── database.py          # DB connection
│   │   └── services/            # Business logic
│   ├── tests/                   # Backend tests
│   ├── uploads/                 # Uploaded files (created at runtime)
│   └── requirements.txt         # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Root component
│   │   ├── components/          # React components
│   │   ├── services/            # API clients, WebSocket
│   │   └── types/               # TypeScript interfaces
│   ├── tests/                   # Frontend tests
│   └── package.json             # npm dependencies
│
├── .specify/                    # Spec-kit documentation
│   └── memory/
│       ├── constitution.md      # Project principles
│       ├── spec.md              # Feature specification
│       ├── plan.md              # Implementation plan
│       └── contracts/           # API contracts
│
└── .env                         # Environment variables (OPENAI_API_KEY)
```

---

## Common Issues

### Backend won't start

**Error**: `ModuleNotFoundError: No module named 'fastapi'`
**Fix**: Make sure virtual environment is activated:
```bash
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

**Error**: `openai.error.AuthenticationError: Invalid API key`
**Fix**: Check `.env` file contains valid `OPENAI_API_KEY`

### Frontend won't start

**Error**: `Cannot find module 'react'`
**Fix**: Delete `node_modules` and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

### WebSocket connection fails

**Error**: `WebSocket connection to 'ws://localhost:8000/ws/...' failed`
**Fix**: Make sure backend is running on port 8000:
```bash
# In backend terminal
uvicorn app.main:app --reload --port 8000
```

### Voice input not working

**Issue**: Microphone button disabled or missing
**Fix**:
1. Use Chrome or Edge browser (Firefox/Safari have limited support)
2. Ensure HTTPS or localhost (required for mic access)
3. Grant microphone permission when prompted

---

## Running Tests

### Backend tests
```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```

### Frontend tests
```bash
cd frontend
npm test
```

---

## Development Workflow

### 1. Start both servers
```bash
# Terminal 1 - Backend
cd backend && source venv/bin/activate && uvicorn app.main:app --reload

# Terminal 2 - Frontend
cd frontend && npm run dev
```

### 2. Make changes
- Backend: Edit files in `backend/app/` → Auto-reloads
- Frontend: Edit files in `frontend/src/` → Hot module replacement

### 3. View logs
- Backend: Terminal 1 shows FastAPI logs
- Frontend: Browser console (F12) shows React logs
- WebSocket: Network tab → WS filter

### 4. Database inspection
```bash
cd backend
sqlite3 chat.db
# Or use a GUI tool like DB Browser for SQLite
```

---

## Production Deployment (Future)

**Not in MVP scope**, but preparation needed:

1. **Environment variables**:
   - Set `DATABASE_URL` to PostgreSQL connection string
   - Keep `OPENAI_API_KEY` secret

2. **Backend**:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
   ```

3. **Frontend**:
   ```bash
   npm run build  # Creates dist/ folder
   # Serve dist/ with nginx or CDN
   ```

4. **File storage**:
   - Migrate from local `uploads/` to S3-compatible storage
   - Update `storage_path` in Attachment model

---

## Next Steps

1. ✅ Backend and frontend running locally
2. ⏭ Implement core features (see [tasks.md](.specify/memory/tasks.md))
3. ⏭ Write tests for each feature
4. ⏭ Deploy to staging environment

---

**Status**: ✅ Quickstart guide complete

**Support**: If you encounter issues not covered here, check:
- Backend logs: Terminal running uvicorn
- Frontend logs: Browser console (F12)
- Network tab: Inspect WebSocket frames
