import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { StreamEvent, StreamEventType, StreamingChatRequest } from '../models/chat';
import { AuthService } from './auth.service';
import { ChatService } from './chat.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class StreamingService {
  private apiUrl = environment.apiUrl;
  private eventSource: EventSource | null = null;
  private abortController: AbortController | null = null;

  constructor(
    private authService: AuthService,
    private chatService: ChatService
  ) {}

  /**
   * Send message with streaming response using fetch API
   * (EventSource doesn't support POST with body easily)
   */
  async sendStreamingMessage(
    content: string,
    chatId: string,
    options: { includThinking?: boolean; maxTokens?: number } = {}
  ): Promise<void> {
    const token = this.authService.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    // Add user message to UI
    this.chatService.addUserMessage(content);

    // Start streaming placeholder
    this.chatService.startStreamingMessage();

    // Prepare request
    const request: StreamingChatRequest = {
      content,
      chat_id: chatId,
      include_thinking: options.includThinking || false,
      max_tokens: options.maxTokens || 512
    };

    this.abortController = new AbortController();

    try {
      const response = await fetch(`${this.apiUrl}/stream/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(request),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (jsonStr.trim()) {
              try {
                const event: StreamEvent = JSON.parse(jsonStr);
                this.handleStreamEvent(event);
              } catch (e) {
                console.warn('Failed to parse SSE event:', jsonStr);
              }
            }
          }
        }
      }

      // Finalize
      this.chatService.finalizeStreamingMessage();

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Stream aborted');
      } else {
        console.error('Streaming error:', error);
        this.chatService.removeStreamingMessage();
      }
      throw error;
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Handle individual stream events
   */
  private handleStreamEvent(event: StreamEvent): void {
    switch (event.type) {
      case 'token':
        this.chatService.appendToStreamingMessage(event.data);
        break;

      case 'thinking_start':
        // Could show thinking indicator
        break;

      case 'thinking_end':
        // Could hide thinking indicator
        break;

      case 'response_start':
        // Response beginning
        break;

      case 'response_end':
        // Response complete
        break;

      case 'done':
        // Stream finished
        break;

      case 'error':
        console.error('Stream error:', event.data);
        this.chatService.removeStreamingMessage();
        break;

      case 'heartbeat':
        // Keep-alive, ignore
        break;
    }
  }

  /**
   * Abort current stream
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
