# Voice Chat Agent

ChatGPT-style web chat interface with real-time messaging, voice input/output, and file attachments.

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m app.main
```

Backend runs on http://localhost:8000

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173

## Requirements

- Python 3.11+
- Node.js 18+
- OpenAI API key (in `.env`)

## Project Structure

```
backend/           # FastAPI backend
frontend/          # React frontend
.specify/          # Spec-kit documentation
.env               # Environment variables
```

## Features

- ✅ Real-time chat via WebSocket
- ✅ Streaming AI responses
- ✅ Session-based conversations
- ⏳ Voice input (coming soon)
- ⏳ File attachments (coming soon)

## Documentation

See [.specify/memory/](.specify/memory/) for full specification, plan, and data model.
