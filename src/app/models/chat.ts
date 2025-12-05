// =============================================================================
// Authentication Models
// =============================================================================

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  created_at?: string;
  last_login?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}

// =============================================================================
// Chat Models
// =============================================================================

export interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string | Date;
  isStreaming?: boolean;
}

export interface ChatSummary {
  id: string;
  title: string;
  updated_at: string;
  message_count: number;
}

export interface ChatDetail {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface CreateChatRequest {
  title?: string;
}

export interface SendMessageRequest {
  content: string;
}

export interface AgentResponse {
  answer: string;
  message_id: number;
  timestamp: string;
}

// =============================================================================
// Streaming Models
// =============================================================================

export interface StreamingChatRequest {
  content: string;
  chat_id?: string;
  include_thinking?: boolean;
  max_tokens?: number;
}

export type StreamEventType =
  | 'token'
  | 'thinking_start'
  | 'thinking_end'
  | 'response_start'
  | 'response_end'
  | 'done'
  | 'error'
  | 'heartbeat';

export interface StreamEvent {
  type: StreamEventType;
  data: string;
}

// =============================================================================
// API Response Models
// =============================================================================

export interface ApiError {
  error: string;
  detail?: string;
}

export interface HealthResponse {
  status: string;
  database: string;
  redis_available: boolean;
  language?: string;
  streaming?: boolean;
  rag_status?: string;
}
