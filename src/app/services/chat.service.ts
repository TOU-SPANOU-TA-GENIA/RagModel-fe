// src/app/services/chat.service.ts
// Complete chat service with thinking support

import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ChatMessage, ChatSummary, ChatDetail, AgentResponse } from '../models/chat';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = environment.apiUrl;

  // Signals for reactive state
  private chatsSignal = signal<ChatSummary[]>([]);
  private activeChatIdSignal = signal<string | null>(null);
  private messagesSignal = signal<ChatMessage[]>([]);
  private loadingSignal = signal<boolean>(false);

  // Public computed signals
  readonly chats = computed(() => this.chatsSignal());
  readonly activeChatId = computed(() => this.activeChatIdSignal());
  readonly activeChat = computed(() => {
    const id = this.activeChatIdSignal();
    return this.chatsSignal().find(c => c.id === id) || null;
  });
  readonly messages = computed(() => this.messagesSignal());
  readonly loading = computed(() => this.loadingSignal());

  constructor(private http: HttpClient) {}

  // =========================================================================
  // Chat Management
  // =========================================================================

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

  createChat(title?: string): Observable<string> {
    return this.http.post<string>(`${this.apiUrl}/chats/`, { title }).pipe(
      tap(chatId => {
        this.loadChats().subscribe();
        this.setActiveChat(chatId);
      })
    );
  }

  setActiveChat(chatId: string): void {
    this.activeChatIdSignal.set(chatId);
    this.loadMessages(chatId);
  }

  loadMessages(chatId: string): void {
    this.loadingSignal.set(true);
    this.http.get<ChatMessage[]>(`${this.apiUrl}/chats/${chatId}/messages`).pipe(
      tap(messages => {
        this.messagesSignal.set(messages);
        this.loadingSignal.set(false);
      }),
      catchError(error => {
        this.loadingSignal.set(false);
        return throwError(() => error);
      })
    ).subscribe();
  }

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

  // =========================================================================
  // Non-streaming message (fallback)
  // =========================================================================

  sendMessage(content: string): Observable<AgentResponse> {
    const chatId = this.activeChatIdSignal();
    if (!chatId) {
      return throwError(() => new Error('No active chat'));
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };

    const placeholderMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true
    };

    this.messagesSignal.update(msgs => [...msgs, userMessage, placeholderMessage]);

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
              isStreaming: false,
              thinking: response.thinking
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

  // =========================================================================
  // Streaming Support Methods
  // =========================================================================

  /**
   * Add user message to UI immediately
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
   * Create placeholder for streaming assistant response
   */
  startStreamingMessage(): void {
    const placeholderMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
      thinkingInProgress: false,
      thinkingExpanded: false,
      thinking: ''
    };
    this.messagesSignal.update(msgs => [...msgs, placeholderMessage]);
  }

  /**
   * Append token to streaming message content
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
   * Append token to streaming message's thinking content (live update)
   */
  appendToStreamingThinking(token: string): void {
    this.messagesSignal.update(msgs => {
      const updated = [...msgs];
      const lastIdx = updated.length - 1;
      if (updated[lastIdx]?.isStreaming) {
        updated[lastIdx] = {
          ...updated[lastIdx],
          thinking: (updated[lastIdx].thinking || '') + token
        };
      }
      return updated;
    });
  }

  /**
   * Update streaming message's thinking state
   */
  updateStreamingThinking(inProgress: boolean, duration?: number): void {
    this.messagesSignal.update(msgs => {
      const updated = [...msgs];
      const lastIdx = updated.length - 1;
      if (updated[lastIdx]?.isStreaming) {
        updated[lastIdx] = {
          ...updated[lastIdx],
          thinkingInProgress: inProgress,
          thinkingExpanded: inProgress ? true : updated[lastIdx].thinkingExpanded,
          thinkingDuration: duration ?? updated[lastIdx].thinkingDuration
        };
      }
      return updated;
    });
  }

  /**
   * Finalize streaming message with thinking data
   */
  finalizeStreamingMessage(thinking?: string, thinkingDuration?: number): void {
    this.messagesSignal.update(msgs => {
      const updated = [...msgs];
      const lastIdx = updated.length - 1;
      if (updated[lastIdx]?.isStreaming) {
        updated[lastIdx] = {
          ...updated[lastIdx],
          isStreaming: false,
          thinkingInProgress: false,
          thinking: thinking || updated[lastIdx].thinking,
          thinkingDuration: thinkingDuration ?? updated[lastIdx].thinkingDuration,
          thinkingExpanded: false  // Collapse after completion
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
   * Remove streaming message (on error)
   */
  removeStreamingMessage(): void {
    this.messagesSignal.update(msgs => msgs.filter(m => !m.isStreaming));
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

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

      // Move to top of list
      const [chat] = updated.splice(idx, 1);
      return [chat, ...updated];
    });
  }

  clearState(): void {
    this.chatsSignal.set([]);
    this.activeChatIdSignal.set(null);
    this.messagesSignal.set([]);
  }
}
