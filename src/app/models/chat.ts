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
  isLoading?: boolean;  // Optional - not used in all places
}

// =============================================================================
// Chat Models
// =============================================================================

export interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  isStreaming?: boolean;

  // Thinking-related properties
  thinking?: string;           // The thinking content from AI
  thinkingExpanded?: boolean;  // Whether thinking section is expanded
  thinkingInProgress?: boolean; // Whether AI is currently thinking
  thinkingDuration?: number;   // How long AI thought (in seconds)
}

export interface ChatSummary {
  id: string;
  title: string;
  updated_at: string;
  message_count: number;
  created_at?: string;
}

export interface ChatDetail {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  user_id?: number;
}

export interface AgentResponse {
  answer: string;
  message_id: number;
  timestamp: string;
  thinking?: string;
}

export interface StreamEvent {
  type: 'token' | 'thinking_start' | 'thinking_end' | 'thinking_token' |
        'response_start' | 'response_end' | 'done' | 'error' | 'heartbeat' | 'status';
  data: string;
  metadata?: any;
}
