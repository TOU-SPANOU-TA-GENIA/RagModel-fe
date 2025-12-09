// src/app/services/chat.service.ts
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { ChatMessage, ChatSummary, Chat, GeneratedFileInfo, FileAttachment } from '../models/chat';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = environment.apiUrl;

  // State signals
  private chatsSignal = signal<ChatSummary[]>([]);
  private messagesSignal = signal<ChatMessage[]>([]);
  private activeChatIdSignal = signal<string | null>(null);
  private loadingSignal = signal(false);

  // Public readonly signals
  readonly chats = this.chatsSignal.asReadonly();
  readonly messages = this.messagesSignal.asReadonly();
  readonly activeChatId = this.activeChatIdSignal.asReadonly();
  readonly isLoading = this.loadingSignal.asReadonly();

  // Computed
  readonly activeChat = computed(() => {
    const id = this.activeChatIdSignal();
    return this.chatsSignal().find(c => c.id === id) || null;
  });

  readonly hasChats = computed(() => this.chatsSignal().length > 0);

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  // ==========================================================================
  // Chat Management
  // ==========================================================================

  loadChats(): Observable<ChatSummary[]> {
    this.loadingSignal.set(true);
    return this.http.get<ChatSummary[]>(`${this.apiUrl}/chats/`).pipe(
      tap(chats => {
        this.chatsSignal.set(chats);
        this.loadingSignal.set(false);
      })
    );
  }

  createChat(title?: string): Observable<{ id: string; title: string }> {
    return this.http.post<{ id: string; title: string }>(
      `${this.apiUrl}/chats/`,
      { title: title || 'Νέα Συνομιλία' }
    ).pipe(
      tap(chat => {
        this.chatsSignal.update(chats => [{
          id: chat.id,
          title: chat.title,
          last_updated: new Date().toISOString(),
          message_count: 0
        }, ...chats]);
        // Set as active and navigate
        this.activeChatIdSignal.set(chat.id);
        this.messagesSignal.set([]);
        this.navigateToChat(chat.id);
      })
    );
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

  renameChat(chatId: string, newTitle: string): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/chats/${chatId}`, { title: newTitle }).pipe(
      tap(() => {
        this.chatsSignal.update(chats =>
          chats.map(c => c.id === chatId ? { ...c, title: newTitle } : c)
        );
      })
    );
  }

  setActiveChat(chatId: string): void {
    this.activeChatIdSignal.set(chatId);
    this.loadMessages(chatId);
  }

  navigateToChat(chatId: string): void {
    this.router.navigate(['/chat', chatId]);
  }

  // ==========================================================================
  // Message Management
  // ==========================================================================

  loadMessages(chatId: string): void {
    this.loadingSignal.set(true);
    this.http.get<ChatMessage[]>(`${this.apiUrl}/chats/${chatId}/messages`).subscribe({
      next: (messages) => {
        this.messagesSignal.set(messages);
        this.loadingSignal.set(false);
      },
      error: (err) => {
        console.error('Failed to load messages:', err);
        this.loadingSignal.set(false);
      }
    });
  }

  sendMessage(content: string): Observable<ChatMessage> {
    const chatId = this.activeChatIdSignal();
    if (!chatId) {
      throw new Error('No active chat');
    }

    return this.http.post<ChatMessage>(
      `${this.apiUrl}/chats/${chatId}/messages`,
      { content, role: 'user' }
    ).pipe(
      tap(() => this.loadMessages(chatId))
    );
  }

  // ==========================================================================
  // Streaming Message Management
  // ==========================================================================

  addUserMessage(content: string, attachedFiles?: FileAttachment[]): void {
    const message: ChatMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      attachedFiles
    };
    this.messagesSignal.update(msgs => [...msgs, message]);
  }

  createStreamingMessage(): void {
    const message: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
      thinking: '',
      thinkingExpanded: true,
      thinkingInProgress: false
    };
    this.messagesSignal.update(msgs => [...msgs, message]);
  }

  appendToStreamingMessage(token: string): void {
    this.messagesSignal.update(msgs => {
      const updated = [...msgs];
      const last = updated[updated.length - 1];
      if (last && last.isStreaming) {
        last.content += token;
      }
      return updated;
    });
  }

  updateStreamingThinking(inProgress: boolean): void {
    this.messagesSignal.update(msgs => {
      const updated = [...msgs];
      const last = updated[updated.length - 1];
      if (last && last.isStreaming) {
        last.thinkingInProgress = inProgress;
        last.thinkingExpanded = true;
      }
      return updated;
    });
  }

  appendToStreamingThinking(token: string): void {
    this.messagesSignal.update(msgs => {
      const updated = [...msgs];
      const last = updated[updated.length - 1];
      if (last && last.isStreaming) {
        last.thinking = (last.thinking || '') + token;
      }
      return updated;
    });
  }

  finalizeStreamingThinking(fullThinking: string, duration: number): void {
    this.messagesSignal.update(msgs => {
      const updated = [...msgs];
      const last = updated[updated.length - 1];
      if (last && last.isStreaming) {
        last.thinking = fullThinking;
        last.thinkingDuration = duration;
        last.thinkingInProgress = false;
        last.thinkingExpanded = false;
      }
      return updated;
    });
  }

  finalizeStreamingMessage(cleanedContent?: string): void {
    this.messagesSignal.update(msgs => {
      const updated = [...msgs];
      const last = updated[updated.length - 1];
      if (last && last.isStreaming) {
        last.isStreaming = false;
        if (cleanedContent !== undefined) {
          last.content = cleanedContent;
        }
      }
      return updated;
    });
  }

  attachGeneratedFile(fileInfo: GeneratedFileInfo): void {
    this.messagesSignal.update(msgs => {
      const updated = [...msgs];
      const last = updated[updated.length - 1];
      if (last && last.role === 'assistant') {
        last.generatedFile = fileInfo;
      }
      return updated;
    });
  }

  removeStreamingMessage(): void {
    this.messagesSignal.update(msgs => {
      if (msgs.length > 0 && msgs[msgs.length - 1].isStreaming) {
        return msgs.slice(0, -1);
      }
      return msgs;
    });
  }

  getCurrentStreamingMessage(): ChatMessage | null {
    const msgs = this.messagesSignal();
    const last = msgs[msgs.length - 1];
    return last?.isStreaming ? last : null;
  }

  // ==========================================================================
  // Utility
  // ==========================================================================

  clearMessages(): void {
    this.messagesSignal.set([]);
  }

  clearActiveChat(): void {
    this.activeChatIdSignal.set(null);
    this.messagesSignal.set([]);
  }

  /**
   * Clear all state (used on logout)
   */
  clearState(): void {
    this.chatsSignal.set([]);
    this.activeChatIdSignal.set(null);
    this.messagesSignal.set([]);
    this.loadingSignal.set(false);
  }

  /**
   * Update chat in list after changes
   */
  private updateChatInList(chatId: string): void {
    this.chatsSignal.update(chats =>
      chats.map(c =>
        c.id === chatId
          ? { ...c, last_updated: new Date().toISOString() }
          : c
      )
    );
  }
}
