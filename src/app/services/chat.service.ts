import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import {
  ChatMessage,
  ChatSummary,
  AgentResponse,
  CreateChatRequest
} from '../models/chat';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private apiUrl = environment.apiUrl;

  // State signals
  private chatsSignal = signal<ChatSummary[]>([]);
  private activeChatIdSignal = signal<string | null>(null);
  private messagesSignal = signal<ChatMessage[]>([]);
  private loadingSignal = signal<boolean>(false);

  // Public computed values
  readonly chats = computed(() => this.chatsSignal());
  readonly activeChatId = computed(() => this.activeChatIdSignal());
  readonly messages = computed(() => this.messagesSignal());
  readonly loading = computed(() => this.loadingSignal());

  readonly activeChat = computed(() => {
    const id = this.activeChatIdSignal();
    return this.chatsSignal().find(c => c.id === id) || null;
  });

  constructor(private http: HttpClient) {}

  /**
   * Load all chats for current user
   */
  loadChats(): Observable<ChatSummary[]> {
    this.loadingSignal.set(true);
    return this.http.get<ChatSummary[]>(`${this.apiUrl}/chats/`).pipe(
      tap(chats => {
        this.chatsSignal.set(chats);
        this.loadingSignal.set(false);
      }),
      catchError(error => {
        this.loadingSignal.set(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Create a new chat with optional title
   */
  createChat(title?: string): Observable<ChatSummary> {
    const request: CreateChatRequest = { title: title || 'Νέα Συνομιλία' };
    return this.http.post<ChatSummary>(`${this.apiUrl}/chats/`, request).pipe(
      tap(chat => {
        this.chatsSignal.update(chats => [chat, ...chats]);
        this.setActiveChat(chat.id);
      })
    );
  }

  /**
   * Set active chat and load its messages
   */
  setActiveChat(chatId: string): void {
    this.activeChatIdSignal.set(chatId);
    this.loadMessages(chatId);
  }

  /**
   * Load messages for a chat
   */
  loadMessages(chatId: string): void {
    this.loadingSignal.set(true);

    this.http.get<ChatMessage[]>(`${this.apiUrl}/chats/${chatId}/messages`).subscribe({
      next: messages => {
        console.log('Loaded messages:', messages);
        this.messagesSignal.set(messages);
        this.loadingSignal.set(false);
      },
      error: (err) => {
        console.error('Failed to load messages:', err);
        this.messagesSignal.set([]);
        this.loadingSignal.set(false);
      }
    });
  }

  /**
   * Update chat title
   */
  updateChatTitle(chatId: string, title: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/chats/${chatId}`, { title }).pipe(
      tap(() => {
        this.chatsSignal.update(chats =>
          chats.map(c => c.id === chatId ? { ...c, title } : c)
        );
      })
    );
  }

  /**
   * Generate a title from content (first ~50 chars, word-boundary aware)
   */
  generateTitleFromContent(content: string): string {
    const cleaned = content.replace(/\s+/g, ' ').trim();
    const maxLength = 50;

    if (cleaned.length <= maxLength) {
      return cleaned;
    }

    const truncated = cleaned.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > 20) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  /**
   * Auto-name chat if it has default title and no messages yet
   */
  autoNameChatIfNeeded(chatId: string, firstUserMessage: string): void {
    const chat = this.chatsSignal().find(c => c.id === chatId);

    if (chat && chat.title === 'Νέα Συνομιλία' && chat.message_count === 0) {
      const generatedTitle = this.generateTitleFromContent(firstUserMessage);
      this.updateChatTitle(chatId, generatedTitle).subscribe({
        error: (err) => console.error('Failed to update chat title:', err)
      });
    }
  }

  /**
   * Send message (non-streaming)
   */
  sendMessage(content: string): Observable<AgentResponse> {
    const chatId = this.activeChatIdSignal();
    if (!chatId) {
      return throwError(() => new Error('No active chat'));
    }

    // Auto-name on first message
    this.autoNameChatIfNeeded(chatId, content);

    // Add user message to UI immediately
    const userMessage: ChatMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };
    this.messagesSignal.update(msgs => [...msgs, userMessage]);

    // Add placeholder for assistant
    const placeholderMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true
    };
    this.messagesSignal.update(msgs => [...msgs, placeholderMessage]);

    return this.http.post<AgentResponse>(
      `${this.apiUrl}/chats/${chatId}/messages`,
      { content }
    ).pipe(
      tap(response => {
        this.messagesSignal.update(msgs => {
          const updated = [...msgs];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.isStreaming) {
            updated[lastIdx] = {
              id: response.message_id,
              role: 'assistant',
              content: response.answer,
              timestamp: response.timestamp,
              isStreaming: false
            };
          }
          return updated;
        });
        this.updateChatInList(chatId);
      }),
      catchError(error => {
        this.messagesSignal.update(msgs => msgs.filter(m => !m.isStreaming));
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete a chat
   */
  deleteChat(chatId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/chats/${chatId}`).pipe(
      tap(() => {
        this.chatsSignal.update(chats => chats.filter(c => c.id !== chatId));
        if (this.activeChatIdSignal() === chatId) {
          this.activeChatIdSignal.set(null);
          this.messagesSignal.set([]);
        }
      })
    );
  }

  /**
   * Append token to streaming message
   */
  appendToStreamingMessage(token: string): void {
    this.messagesSignal.update(msgs => {
      const updated = [...msgs];
      const lastIdx = updated.length - 1;
      if (updated[lastIdx]?.isStreaming) {
        updated[lastIdx] = {
          ...updated[lastIdx],
          content: updated[lastIdx].content + token
        };
      }
      return updated;
    });
  }

  /**
   * Finalize streaming message
   */
  finalizeStreamingMessage(): void {
    this.messagesSignal.update(msgs => {
      const updated = [...msgs];
      const lastIdx = updated.length - 1;
      if (updated[lastIdx]?.isStreaming) {
        updated[lastIdx] = {
          ...updated[lastIdx],
          isStreaming: false
        };
      }
      return updated;
    });

    const chatId = this.activeChatIdSignal();
    if (chatId) {
      this.updateChatInList(chatId);
    }
  }

  /**
   * Add user message for streaming flow
   */
  addUserMessage(content: string): void {
    const userMessage: ChatMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };
    this.messagesSignal.update(msgs => [...msgs, userMessage]);
  }

  /**
   * Start streaming placeholder
   */
  startStreamingMessage(): void {
    const placeholderMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true
    };
    this.messagesSignal.update(msgs => [...msgs, placeholderMessage]);
  }

  /**
   * Remove streaming message on error
   */
  removeStreamingMessage(): void {
    this.messagesSignal.update(msgs => msgs.filter(m => !m.isStreaming));
  }

  /**
   * Update chat in list after new message
   */
  private updateChatInList(chatId: string): void {
    this.chatsSignal.update(chats => {
      const idx = chats.findIndex(c => c.id === chatId);
      if (idx === -1) return chats;

      const updated = [...chats];
      updated[idx] = {
        ...updated[idx],
        updated_at: new Date().toISOString(),
        message_count: updated[idx].message_count + 1
      };

      const [chat] = updated.splice(idx, 1);
      return [chat, ...updated];
    });
  }

  /**
   * Clear all state (for logout)
   */
  clearState(): void {
    this.chatsSignal.set([]);
    this.activeChatIdSignal.set(null);
    this.messagesSignal.set([]);
  }

  uploadFile(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/upload`, formData);
  }
}
