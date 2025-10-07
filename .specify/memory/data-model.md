# Data Model: Voice Chat Agent

**Date**: 2025-10-06

## Entity Relationship Diagram

```
┌─────────────────┐
│  Conversation   │
├─────────────────┤
│ id (PK)         │───┐
│ session_id      │   │
│ title           │   │
│ created_at      │   │
└─────────────────┘   │
                      │ 1:N
                      │
                   ┌──▼───────────┐
                   │   Message    │
                   ├──────────────┤
                   │ id (PK)      │───┐
                   │ conversation │   │
                   │ role         │   │
                   │ content      │   │
                   │ metadata     │   │
                   │ created_at   │   │
                   └──────────────┘   │ 1:N
                                      │
                                   ┌──▼────────────┐
                                   │  Attachment   │
                                   ├───────────────┤
                                   │ id (PK)       │
                                   │ message_id    │
                                   │ filename      │
                                   │ file_size     │
                                   │ mime_type     │
                                   │ storage_path  │
                                   │ created_at    │
                                   └───────────────┘
```

---

## Entities

### Conversation

**Purpose**: Groups related messages into a single chat session

**Fields**:
- `id`: UUID, Primary Key
- `session_id`: String (browser-generated, for anonymous user tracking)
- `title`: String, Nullable (auto-generated from first message, max 100 chars)
- `created_at`: DateTime (UTC, auto-set)

**Validation Rules**:
- `session_id` must be non-empty and max 255 chars
- `title` auto-truncated to 100 chars if longer
- `created_at` defaults to current timestamp

**State Transitions**:
- Created → Active (when first message added)
- Active → Active (as messages continue)
- No deletion (conversations persist indefinitely)

**Indexes**:
- Primary: `id`
- Secondary: `session_id` (for listing user's conversations)
- Secondary: `created_at` (for sorting by recency)

---

### Message

**Purpose**: Individual message from user or AI assistant

**Fields**:
- `id`: UUID, Primary Key
- `conversation_id`: UUID, Foreign Key → Conversation(id), NOT NULL
- `role`: Enum('user', 'assistant'), NOT NULL
- `content`: Text, NOT NULL (message body)
- `metadata`: JSON, Nullable (e.g., `{"voice": true, "file_refs": ["uuid1", "uuid2"]}`)
- `created_at`: DateTime (UTC, auto-set)

**Validation Rules**:
- `role` must be exactly 'user' or 'assistant'
- `content` must not be empty string
- `metadata` must be valid JSON if present
- `conversation_id` must reference existing conversation

**Relationships**:
- Belongs to ONE Conversation
- Has ZERO or MORE Attachments

**Indexes**:
- Primary: `id`
- Secondary: `conversation_id, created_at` (for message ordering within conversation)

**Example metadata**:
```json
{
  "voice": true,           // Was this message created via voice input?
  "file_refs": [           // UUIDs of attached files
    "550e8400-e29b-41d4-a716-446655440000"
  ],
  "transcription_confidence": 0.95  // Optional: voice recognition confidence
}
```

---

### Attachment

**Purpose**: Files uploaded by user and attached to messages

**Fields**:
- `id`: UUID, Primary Key
- `message_id`: UUID, Foreign Key → Message(id), NOT NULL
- `filename`: String, NOT NULL (original filename from upload)
- `file_size`: Integer, NOT NULL (bytes)
- `mime_type`: String, NOT NULL (e.g., "image/png", "text/plain")
- `storage_path`: String, NOT NULL (local path: "uploads/{uuid}_{filename}")
- `created_at`: DateTime (UTC, auto-set)

**Validation Rules**:
- `file_size` <= 25 * 1024 * 1024 (25MB limit)
- `mime_type` must be in allowed list:
  - Text: `text/plain`, `text/markdown`
  - Images: `image/jpeg`, `image/png`, `image/gif`
  - Code: `text/x-python`, `application/javascript`, etc.
  - Documents: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `storage_path` must start with "uploads/" (prevents path traversal)
- `filename` sanitized to remove special chars

**Relationships**:
- Belongs to ONE Message

**Indexes**:
- Primary: `id`
- Secondary: `message_id` (for fetching attachments with message)

**Lifecycle**:
1. File uploaded via POST /api/upload → Attachment record created (orphan, no message_id yet)
2. User sends message referencing attachment UUID → `message_id` set
3. Orphan attachments (no message_id after 1 hour) can be cleaned up via cron job

---

## SQLAlchemy Models (Python)

```python
from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, JSON, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(String(255), nullable=False, index=True)
    title = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False, index=True)
    role = Column(Enum("user", "assistant", name="message_role"), nullable=False)
    content = Column(Text, nullable=False)
    metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    conversation = relationship("Conversation", back_populates="messages")
    attachments = relationship("Attachment", back_populates="message", cascade="all, delete-orphan")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id"), nullable=True, index=True)
    filename = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    storage_path = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    message = relationship("Message", back_populates="attachments")
```

---

## TypeScript Interfaces (Frontend)

```typescript
export interface Conversation {
  id: string;
  sessionId: string;
  title: string | null;
  createdAt: string;  // ISO 8601 format
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    voice?: boolean;
    file_refs?: string[];
    transcription_confidence?: number;
  };
  createdAt: string;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  messageId: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}
```

---

## Database Migrations

**Initial Schema (v1)**:
```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    title VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conversations_session ON conversations(session_id);
CREATE INDEX idx_conversations_created ON conversations(created_at);

CREATE TABLE messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);

CREATE TABLE attachments (
    id UUID PRIMARY KEY,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL CHECK (file_size <= 26214400),  -- 25MB
    mime_type VARCHAR(100) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attachments_message ON attachments(message_id);
```

---

## Storage Considerations

**SQLite (Development)**:
- Single file database: `chat.db`
- No concurrent write issues (single user)
- JSON support via `json1` extension

**PostgreSQL (Production)**:
- Full JSONB support for metadata queries
- Better concurrent connection handling
- UUID extension: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`

**File Storage**:
- Local filesystem: `backend/uploads/{uuid}_{filename}`
- Serve via FastAPI static files route: `/files/{file_id}`
- Future: Migrate to S3 without changing Attachment model (only change `storage_path` format)

---

**Status**: ✅ Data model complete and validated against spec requirements
