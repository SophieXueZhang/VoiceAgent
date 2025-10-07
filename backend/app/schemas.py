"""Pydantic schemas for request/response validation."""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class FileUploadResponse(BaseModel):
    file_id: str
    filename: str
    size: int
    mime_type: str


class AttachmentSchema(BaseModel):
    id: str
    filename: str
    file_size: int
    mime_type: str

    class Config:
        from_attributes = True


class MessageSchema(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    metadata: Optional[dict] = None
    attachments: List[AttachmentSchema] = []
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationSchema(BaseModel):
    id: str
    session_id: str
    title: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class WebSocketMessage(BaseModel):
    type: str
    content: Optional[str] = None
    metadata: Optional[dict] = None


class WebSocketResponse(BaseModel):
    type: str
    content: Optional[str] = None
    done: Optional[bool] = None
    message_id: Optional[str] = None
    message: Optional[str] = None
