// src/app/services/chat.service.ts
// Chat service with navigation, rename, and auto-title support

import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ChatMessage, ChatSummary, ChatDetail, AgentResponse } from '../models/chat';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = environment.apiUrl;
  private router = inject(Router);

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

  /**
   * Create a new chat and navigate to it.
   * Uses generic approach: after successful creation, set active and navigate.
   */
  createChat(title?: string): Observable<ChatSummary> {
    return this.http.post<ChatSummary>(`${this.apiUrl}/chats/`, {
      title: title || 'Νέα Συνομιλία'
    }).pipe(
      tap(chat => {
        // Add to list at the beginning (most recent first)
        this.chatsSignal.update(chats => [chat, ...chats]);

        // Set as active and navigate
        this.setActiveChat(chat.id);
        this.navigateToChat(chat.id);
      }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Navigate to a specific chat.
   * Generic approach: routing is decoupled from business logic.
   */
  navigateToChat(chatId: string): void {
    this.router.navigate(['/chat', chatId]);
  }

  /**
   * Set active chat and load its messages.
   */
  setActiveChat(chatId: string): void {
    if (this.activeChatIdSignal() === chatId) return;

    this.activeChatIdSignal.set(chatId);
    this.loadMessages(chatId);
  }

  /**
   * Rename a chat.
   * Generic approach: accepts any chat ID and new title.
   */
  renameChat(chatId: string, newTitle: string): Observable<ChatSummary> {
    return this.http.patch<ChatSummary>(`${this.apiUrl}/chats/${chatId}`, {
      title: newTitle
    }).pipe(
      tap(updatedChat => {
        // Update in the chats list
        this.chatsSignal.update(chats =>
          chats.map(c => c.id === chatId ? { ...c, title: newTitle } : c)
        );
      }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Generate title from content and update chat.
   * Generic approach: extracts meaningful title from any text content.
   */
  generateAndSetTitle(chatId: string, content: string): void {
    const title = this.generateTitleFromContent(content);
    if (title) {
      this.renameChat(chatId, title).subscribe({
        error: err => console.error('Failed to auto-rename chat:', err)
      });
    }
  }

  /**
   * Extract a meaningful title from content.
   * Generic approach: works with any language content, truncates intelligently.
   */
  private generateTitleFromContent(content: string): string {
    if (!content || content.trim().length === 0) return '';

    // Clean up the content
    let cleaned = content
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/\[.*?\]\(.*?\)/g, '') // Remove markdown links
      .replace(/[#*_~`]/g, '')        // Remove markdown formatting
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .trim();

    // Get first sentence or meaningful chunk
    const firstSentence = cleaned.match(/^[^.!?;:\n]+/)?.[0] || cleaned;

    // Truncate to reasonable title length
    const maxLength = 50;
    if (firstSentence.length <= maxLength) {
      return firstSentence;
    }

    // Truncate at word boundary
    const truncated = firstSentence.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    return lastSpace > 20
      ? truncated.substring(0, lastSpace) + '...'
      : truncated + '...';
  }

  deleteChat(chatId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/chats/${chatId}`).pipe(
      tap(() => {
        this.chatsSignal.update(chats => chats.filter(c => c.id !== chatId));

        // If deleted the active chat, clear selection
        if (this.activeChatIdSignal() === chatId) {
          this.activeChatIdSignal.set(null);
          this.messagesSignal.set([]);
          this.router.navigate(['/chat']);
        }
      }),
      catchError(error => throwError(() => error))
    );
  }

  // =========================================================================
  // Message Management
  // =========================================================================

  private loadMessages(chatId: string): void {
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

        // Auto-title on first response
        this.autoTitleIfNeeded(chatId, response.answer);
      }),
      catchError(error => {
        this.messagesSignal.update(msgs => msgs.filter(m => !m.isStreaming));
        return throwError(() => error);
      })
    );
  }

  /**
   * Auto-title chat if it still has the default title.
   * Generic approach: checks for default pattern, not specific strings.
   */
  private autoTitleIfNeeded(chatId: string, responseContent: string): void {
    const chat = this.activeChat();
    if (!chat) return;

    // Check if title is still the default (generic pattern matching)
    const isDefaultTitle = this.isDefaultChatTitle(chat.title);
    const isFirstResponse = this.messages().filter(m => m.role === 'assistant').length === 1;

    if (isDefaultTitle && isFirstResponse) {
      this.generateAndSetTitle(chatId, responseContent);
    }
  }

  /**
   * Check if a title matches the default pattern.
   * Generic approach: supports multiple default patterns.
   */
  private isDefaultChatTitle(title: string): boolean {
    const defaultPatterns = [
      /^νέα συνομιλία$/i,
      /^new chat$/i,
      /^untitled$/i,
      /^chat \d+$/i
    ];
    return defaultPatterns.some(pattern => pattern.test(title.trim()));
  }

  private updateChatInList(chatId: string): void {
    this.chatsSignal.update(chats => {
      const idx = chats.findIndex(c => c.id === chatId);
      if (idx === -1) return chats;

      const updated = [...chats];
      const chat = { ...updated[idx], updated_at: new Date().toISOString() };
      updated.splice(idx, 1);
      return [chat, ...updated];
    });
  }

  // =========================================================================
  // Streaming Support Methods
  // =========================================================================

  addUserMessage(content: string): void {
    const userMessage: ChatMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };
    this.messagesSignal.update(msgs => [...msgs, userMessage]);
  }

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
   * Finalize streaming and trigger auto-title.
   */
  finalizeStreamingMessage(thinking?: string, thinkingDuration?: number): void {
    const chatId = this.activeChatIdSignal();

    this.messagesSignal.update(msgs => {
      const updated = [...msgs];
      const lastIdx = updated.length - 1;
      if (updated[lastIdx]?.isStreaming) {
        const finalContent = updated[lastIdx].content;
        updated[lastIdx] = {
          ...updated[lastIdx],
          isStreaming: false,
          thinkingInProgress: false,
          thinking: thinking || updated[lastIdx].thinking,
          thinkingDuration: thinkingDuration ?? updated[lastIdx].thinkingDuration
        };

        // Trigger auto-title after finalizing
        if (chatId) {
          setTimeout(() => this.autoTitleIfNeeded(chatId, finalContent), 100);
        }
      }
      return updated;
    });

    if (chatId) {
      this.updateChatInList(chatId);
    }
  }

  /**
   * Remove streaming message (on error).
   */
  removeStreamingMessage(): void {
    this.messagesSignal.update(msgs => msgs.filter(m => !m.isStreaming));
  }

  clearState(): void {
    this.chatsSignal.set([]);
    this.activeChatIdSignal.set(null);
    this.messagesSignal.set([]);
  }
}
