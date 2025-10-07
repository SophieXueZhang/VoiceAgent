"""SQLAlchemy database models."""
from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, JSON, Enum as SQLEnum
from sqlalchemy.dialects.sqlite import TEXT
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from .database import Base


def generate_uuid():
    """Generate UUID as string for SQLite compatibility."""
    return str(uuid.uuid4())


class Conversation(Base):
    """Conversation model - groups related messages."""
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(255), nullable=False, index=True)
    title = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    """Message model - individual user or assistant message."""
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False, index=True)
    role = Column(SQLEnum("user", "assistant", name="message_role"), nullable=False)
    content = Column(Text, nullable=False)
    msg_metadata = Column(TEXT, nullable=True)  # JSON stored as TEXT in SQLite (renamed from 'metadata' - reserved word)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    conversation = relationship("Conversation", back_populates="messages")
    attachments = relationship("Attachment", back_populates="message", cascade="all, delete-orphan")


class Attachment(Base):
    """Attachment model - files uploaded by users."""
    __tablename__ = "attachments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    message_id = Column(String(36), ForeignKey("messages.id"), nullable=True, index=True)
    filename = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    storage_path = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    message = relationship("Message", back_populates="attachments")
