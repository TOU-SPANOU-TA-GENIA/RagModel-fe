// src/app/services/streaming.service.ts
import { Injectable } from '@angular/core';
import { ChatService } from './chat.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { StreamEvent, GeneratedFileInfo } from '../models/chat';

@Injectable({
  providedIn: 'root'
})
export class StreamingService {
  private apiUrl = environment.apiUrl;
  private abortController: AbortController | null = null;

  // Thinking tracking
  private isThinking = false;
  private thinkingStartTime: number | null = null;
  private currentThinking: string[] = [];

  // Stop tokens to filter
  private readonly STOP_TOKENS = new Set([
    '<|im_end|>',
    '<|endoftext|>',
    '<|im_start|>',
    '</s>',
    '<s>',
    '[PAD]',
    '<pad>',
    '<eos>',
    '<|end|>',
  ]);

  constructor(
    private chatService: ChatService,
    private authService: AuthService
  ) {}

  /**
   * Send a streaming message with optional file attachments
   */
  async sendStreamingMessage(
    content: string,
    chatId: string,
    includeThinking: boolean = true,
    fileIds: string[] = []
  ): Promise<void> {
    // Cancel any existing stream
    this.cancelStream();
    this.abortController = new AbortController();

    // Reset thinking state
    this.isThinking = false;
    this.thinkingStartTime = null;
    this.currentThinking = [];

    // Add user message immediately
    this.chatService.addUserMessage(content);

    // Create streaming placeholder
    this.chatService.createStreamingMessage();

    try {
      const token = this.authService.getToken();

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
          max_tokens: 4096,  // Higher max tokens for longer responses
          file_ids: fileIds.length > 0 ? fileIds : undefined
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
        this.chatService.updateStreamingThinking(true);
        break;

      case 'thinking_token':
        if (this.isThinking && event.data) {
          this.currentThinking.push(event.data);
          this.chatService.appendToStreamingThinking(event.data);
        }
        break;

      case 'thinking_end':
        this.isThinking = false;
        const duration = this.thinkingStartTime
          ? Math.round((Date.now() - this.thinkingStartTime) / 1000)
          : 0;
        this.chatService.finalizeStreamingThinking(
          this.currentThinking.join(''),
          duration
        );
        break;

      case 'response_start':
        // Response is starting
        break;

      case 'token':
        if (!this.isThinking && event.data) {
          // Filter stop tokens before displaying
          const cleanedToken = this.cleanToken(event.data);
          if (cleanedToken) {
            this.chatService.appendToStreamingMessage(cleanedToken);
          }
        }
        break;

      case 'response_end':
        // Response complete
        break;

      case 'file_generated':
        // Handle generated file
        if (event.data) {
          try {
            const fileInfo: GeneratedFileInfo = JSON.parse(event.data);
            this.chatService.attachGeneratedFile(fileInfo);
          } catch (e) {
            console.warn('Invalid file_generated data:', event.data);
          }
        }
        break;

      case 'done':
        this.finalizeMessage();
        break;

      case 'error':
        console.error('Stream error:', event.data);
        this.chatService.removeStreamingMessage();
        break;

      case 'heartbeat':
      case 'status':
        // Ignore heartbeat and status events
        break;
    }
  }

  /**
   * Clean token by removing stop tokens
   */
  private cleanToken(token: string): string {
    // Check if entire token is a stop token
    if (this.STOP_TOKENS.has(token.trim())) {
      return '';
    }

    // Remove stop tokens from within the token
    let result = token;
    for (const stop of this.STOP_TOKENS) {
      result = result.split(stop).join('');
    }

    return result;
  }

  /**
   * Finalize the streaming message
   */
  private finalizeMessage(): void {
    // Get the full response and clean it
    const message = this.chatService.getCurrentStreamingMessage();
    if (message) {
      const cleanedContent = this.cleanFinalResponse(message.content);
      this.chatService.finalizeStreamingMessage(cleanedContent);
    }
  }

  /**
   * Clean the final response of any remaining artifacts
   */
  private cleanFinalResponse(content: string): string {
    let result = content;

    // Remove stop tokens
    for (const stop of this.STOP_TOKENS) {
      result = result.split(stop).join('');
    }

    // Remove language markers
    result = result.replace(/\/(zh|en|el|think|no_think)\b/g, '');

    // Remove any remaining special tags
    result = result.replace(/<\|[^|]+\|>/g, '');

    // Normalize whitespace
    result = result.replace(/\n{3,}/g, '\n\n');
    result = result.trim();

    return result;
  }

  /**
   * Cancel the current stream
   */
  cancelStream(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Check if currently streaming
   */
  get isStreaming(): boolean {
    return this.abortController !== null;
  }
}
