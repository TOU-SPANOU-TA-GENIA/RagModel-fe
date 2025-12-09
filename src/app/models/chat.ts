// src/app/models/chat.ts
// Chat and Auth related models and interfaces

// =============================================================================
// Auth Models
// =============================================================================

export interface User {
  id: number;
  username: string;
  email: string;
  created_at?: string;
  last_login?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading?: boolean;
}

// =============================================================================
// Chat Models
// =============================================================================

export interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;

  // Streaming state
  isStreaming?: boolean;

  // Thinking support
  thinking?: string;
  thinkingExpanded?: boolean;
  thinkingInProgress?: boolean;
  thinkingDuration?: number;

  // File attachments
  attachedFiles?: FileAttachment[];

  // Generated file (for assistant responses that create files)
  generatedFile?: GeneratedFileInfo;
}

export interface ChatSummary {
  id: string;
  title: string;
  last_updated?: string;  // From frontend
  updated_at?: string;    // From backend API
  message_count: number;
}

export interface ChatDetail {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  user_id?: number;
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  created: string;
  updated: string;
}

export interface AgentResponse {
  answer: string;
  message_id: number;
  timestamp: string;
  thinking?: string;
}

// =============================================================================
// File Models
// =============================================================================

export interface FileAttachment {
  file_id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  content_type: string;
}

export interface GeneratedFileInfo {
  file_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  download_url: string;
}

// =============================================================================
// Request/Response Models
// =============================================================================

export interface SendMessageRequest {
  content: string;
  chat_id?: string;
  include_thinking?: boolean;
  max_tokens?: number;
  file_ids?: string[];
}

export interface StreamEvent {
  type: 'status' | 'thinking_start' | 'thinking_token' | 'thinking_end' |
        'response_start' | 'token' | 'response_end' | 'file_generated' |
        'done' | 'error' | 'heartbeat';
  data: string;
}
