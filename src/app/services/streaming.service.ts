// src/app/services/streaming.service.ts
// Streaming service with thinking support

import { Injectable } from '@angular/core';
import { ChatService } from './chat.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { StreamEvent } from '../models/chat';

@Injectable({
  providedIn: 'root'
})
export class StreamingService {
  private abortController: AbortController | null = null;
  private apiUrl = environment.apiUrl;

  // Thinking state
  private isThinking = false;
  private thinkingStartTime: number = 0;
  private currentThinking: string[] = [];

  constructor(
    private chatService: ChatService,
    private authService: AuthService
  ) {}

  /**
   * Send a message and stream the response with thinking support.
   */
  async sendStreamingMessage(
    content: string,
    chatId: string,
    includeThinking: boolean = true
  ): Promise<void> {
    // Add user message to UI immediately
    this.chatService.addUserMessage(content);

    // Create placeholder for assistant response with thinking support
    this.chatService.startStreamingMessage();

    // Reset thinking state
    this.isThinking = false;
    this.currentThinking = [];
    this.thinkingStartTime = 0;

    // Setup abort controller for cancellation
    this.abortController = new AbortController();

    try {
      const token = this.authService.token();

      const response = await fetch(`${this.apiUrl}/stream/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content,
          chat_id: chatId,
          include_thinking: includeThinking,
          max_tokens: 512
        }),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        throw new Error(`Stream failed: ${response.status}`);
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
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr) {
              try {
                const event: StreamEvent = JSON.parse(jsonStr);
                this.handleStreamEvent(event);
              } catch (e) {
                console.warn('Non-JSON SSE data:', jsonStr);
              }
            }
          }
        }
      }

      // Finalize with thinking data
      this.finalizeMessage();

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Stream aborted by user');
      } else {
        console.error('Streaming error:', error);
        this.chatService.removeStreamingMessage();
      }
      throw error;
    } finally {
      this.abortController = null;
      this.isThinking = false;
    }
  }

  /**
   * Handle individual stream events from backend
   */
  private handleStreamEvent(event: StreamEvent): void {
    switch (event.type) {
      case 'thinking_start':
        this.isThinking = true;
        this.thinkingStartTime = Date.now();
        this.currentThinking = [];
        // Mark message as thinking in progress and auto-expand
        this.chatService.updateStreamingThinking(true);
        break;

      case 'thinking_token':
        // Accumulate and show thinking content live
        if (this.isThinking && event.data) {
          this.currentThinking.push(event.data);
          // Update the thinking content in real-time
          this.chatService.appendToStreamingThinking(event.data);
        }
        break;

      case 'thinking_end':
        this.isThinking = false;
        const duration = this.thinkingStartTime
          ? Math.round((Date.now() - this.thinkingStartTime) / 1000)
          : undefined;
        // Mark thinking complete with duration
        this.chatService.updateStreamingThinking(false, duration);
        break;

      case 'token':
        // Only append to visible content if not in thinking mode
        if (!this.isThinking) {
          this.chatService.appendToStreamingMessage(event.data);
        } else {
          // If still getting tokens during "thinking", treat as thinking
          this.currentThinking.push(event.data);
          this.chatService.appendToStreamingThinking(event.data);
        }
        break;

      case 'response_start':
        // Response is starting after thinking
        break;

      case 'response_end':
        // Response complete
        break;

      case 'status':
        console.log('Status:', event.data);
        break;

      case 'done':
        // Stream finished
        break;

      case 'error':
        console.error('Stream error from server:', event.data);
        this.chatService.removeStreamingMessage();
        break;

      case 'heartbeat':
        // Keep-alive, ignore
        break;

      default:
        console.warn('Unknown event type:', event.type);
    }
  }

  /**
   * Finalize message with thinking data
   */
  private finalizeMessage(): void {
    const thinkingDuration = this.thinkingStartTime
      ? Math.round((Date.now() - this.thinkingStartTime) / 1000)
      : undefined;

    const thinkingContent = this.currentThinking.length > 0
      ? this.currentThinking.join('')
      : undefined;

    this.chatService.finalizeStreamingMessage(thinkingContent, thinkingDuration);
  }

  /**
   * Abort the current stream
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      this.isThinking = false;
    }
  }

  /**
   * Check if currently streaming
   */
  get isStreaming(): boolean {
    return this.abortController !== null;
  }
}
