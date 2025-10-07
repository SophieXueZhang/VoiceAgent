"""FastAPI main application with WebSocket support for real-time chat."""
import os
import json
from typing import Dict
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import aiofiles

from .database import get_db, init_db
from .models import Conversation, Message, Attachment
from .schemas import (
    FileUploadResponse,
    ConversationSchema,
    MessageSchema,
    WebSocketMessage,
    WebSocketResponse
)
from .services.openai_service import stream_chat_response, build_message_history

# Initialize FastAPI app
app = FastAPI(title="Voice Chat Agent API", version="1.0.0")

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Initialize database on startup
@app.on_event("startup")
def startup_event():
    init_db()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[session_id] = websocket

    def disconnect(self, session_id: str):
        self.active_connections.pop(session_id, None)

    async def send_json(self, session_id: str, data: dict):
        ws = self.active_connections.get(session_id)
        if ws:
            await ws.send_json(data)


manager = ConnectionManager()


# WebSocket endpoint for real-time chat
@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for bidirectional chat communication.

    Client sends: {"type": "message", "content": "...", "metadata": {...}}
    Server sends: {"type": "response_chunk", "content": "...", "done": false}
    """
    await manager.connect(session_id, websocket)

    # Send connection acknowledgment
    await websocket.send_json({
        "type": "connection_ack",
        "session_id": session_id
    })

    try:
        # Get DB session (note: simplified, in prod use async SQLAlchemy)
        from .database import SessionLocal
        db = SessionLocal()

        while True:
            # Receive message from client
            data = await websocket.receive_json()
            msg = WebSocketMessage(**data)

            if msg.type == "message":
                # Find or create conversation
                conversation = db.query(Conversation).filter(
                    Conversation.session_id == session_id
                ).order_by(Conversation.created_at.desc()).first()

                if not conversation:
                    conversation = Conversation(session_id=session_id)
                    db.add(conversation)
                    db.commit()
                    db.refresh(conversation)

                # Save user message
                user_message = Message(
                    conversation_id=conversation.id,
                    role="user",
                    content=msg.content,
                    msg_metadata=json.dumps(msg.metadata) if msg.metadata else None
                )
                db.add(user_message)
                db.commit()

                # Auto-generate conversation title from first message
                if not conversation.title:
                    conversation.title = msg.content[:100]
                    db.commit()

                # Get conversation history
                messages = db.query(Message).filter(
                    Message.conversation_id == conversation.id
                ).order_by(Message.created_at).all()

                history = [{"role": m.role, "content": m.content} for m in messages]

                # Stream AI response
                assistant_content = ""
                async for chunk in stream_chat_response(history):
                    assistant_content += chunk
                    await websocket.send_json({
                        "type": "response_chunk",
                        "content": chunk,
                        "done": False
                    })

                # Save assistant message
                assistant_message = Message(
                    conversation_id=conversation.id,
                    role="assistant",
                    content=assistant_content
                )
                db.add(assistant_message)
                db.commit()
                db.refresh(assistant_message)

                # Send completion signal
                await websocket.send_json({
                    "type": "response_complete",
                    "message_id": assistant_message.id
                })

            elif msg.type == "stop_generation":
                # TODO: Implement generation stopping
                pass

    except WebSocketDisconnect:
        manager.disconnect(session_id)
    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.send_json({
            "type": "error",
            "message": str(e)
        })
    finally:
        db.close()
        manager.disconnect(session_id)


# File upload endpoint
@app.post("/api/upload", response_model=FileUploadResponse)
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a file attachment.

    Max size: 25MB
    Allowed types: text, images, code, documents, PDFs
    """
    # Check file size
    file.file.seek(0, 2)  # Seek to end
    size = file.file.tell()
    file.file.seek(0)  # Reset to beginning

    if size > 25 * 1024 * 1024:  # 25MB
        raise HTTPException(status_code=413, detail="File size exceeds 25MB limit")

    # Validate MIME type
    allowed_types = [
        "text/", "image/", "application/pdf",
        "application/javascript", "application/json",
        "application/vnd.openxmlformats-officedocument"
    ]

    if not any(file.content_type.startswith(t) for t in allowed_types):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}"
        )

    # Generate unique filename
    from .models import generate_uuid
    file_id = generate_uuid()
    safe_filename = file.filename.replace(" ", "_")
    storage_path = f"{UPLOAD_DIR}/{file_id}_{safe_filename}"

    # Save file
    async with aiofiles.open(storage_path, 'wb') as f:
        content = await file.read()
        await f.write(content)

    # Create attachment record (orphan until attached to message)
    from .database import SessionLocal
    db = SessionLocal()
    attachment = Attachment(
        id=file_id,
        filename=file.filename,
        file_size=size,
        mime_type=file.content_type,
        storage_path=storage_path
    )
    db.add(attachment)
    db.commit()
    db.close()

    return FileUploadResponse(
        file_id=file_id,
        filename=file.filename,
        size=size,
        mime_type=file.content_type
    )


# Get conversations for a session
@app.get("/api/conversations", response_model=list[ConversationSchema])
def get_conversations(session_id: str = Query(...), db: Session = Depends(get_db)):
    """List all conversations for a given session ID."""
    conversations = db.query(Conversation).filter(
        Conversation.session_id == session_id
    ).order_by(Conversation.created_at.desc()).all()

    return conversations


# Get messages in a conversation
@app.get("/api/conversations/{conversation_id}/messages", response_model=list[MessageSchema])
def get_conversation_messages(conversation_id: str, db: Session = Depends(get_db)):
    """Get all messages in a conversation with attachments."""
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.created_at).all()

    return messages


# Health check endpoint
@app.get("/health")
def health_check():
    """Simple health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
