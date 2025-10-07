export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    voice?: boolean;
    file_refs?: string[];
  };
  created_at: string;
}

export interface Conversation {
  id: string;
  session_id: string;
  title: string | null;
  created_at: string;
}

export interface Attachment {
  id: string;
  filename: string;
  file_size: number;
  mime_type: string;
}

export interface WebSocketMessage {
  type: 'message' | 'stop_generation';
  content?: string;
  metadata?: {
    voice?: boolean;
    attachments?: string[];
  };
}

export interface WebSocketResponse {
  type: 'response_chunk' | 'response_complete' | 'error' | 'connection_ack';
  content?: string;
  done?: boolean;
  message_id?: string;
  message?: string;
  session_id?: string;
}
