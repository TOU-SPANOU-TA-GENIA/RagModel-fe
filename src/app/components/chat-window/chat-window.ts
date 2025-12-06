// src/app/components/chat-window/chat-window.ts
import { Component, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { ChatService } from '../../services/chat.service';
import { StreamingService } from '../../services/streaming.service';
import { ChatMessage } from '../../models/chat';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TextareaModule,
    ProgressSpinnerModule,
    TooltipModule
  ],
  templateUrl: './chat-window.html',
  styleUrl: './chat-window.scss'
})
export class ChatWindowComponent implements AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('messageInput') private messageInput!: ElementRef;

  newMessage = '';
  sending = false;
  useStreaming = true;
  showThinking = true;  // Global toggle for showing thinking sections

  private shouldScroll = false;

  constructor(
    public chatService: ChatService,
    private streamingService: StreamingService
  ) {}

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  async sendMessage(): Promise<void> {
    const content = this.newMessage.trim();
    if (!content || this.sending) return;

    const chatId = this.chatService.activeChatId();
    if (!chatId) return;

    this.newMessage = '';
    this.sending = true;
    this.shouldScroll = true;

    try {
      if (this.useStreaming) {
        // Pass showThinking to request thinking from backend
        await this.streamingService.sendStreamingMessage(content, chatId, this.showThinking);
      } else {
        await this.chatService.sendMessage(content).toPromise();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      this.sending = false;
      this.shouldScroll = true;
      this.focusInput();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  trackMessage(index: number, message: ChatMessage): string {
    return `${index}-${message.role}-${message.timestamp}`;
  }

  /**
   * Toggle global thinking visibility
   */
  toggleThinking(): void {
    this.showThinking = !this.showThinking;
  }

  /**
   * Toggle individual message's thinking expansion
   */
  toggleMessageThinking(message: ChatMessage): void {
    message.thinkingExpanded = !message.thinkingExpanded;
  }

  /**
   * Parse thinking text into bullet points
   */
  parseThinking(thinking: string): string[] {
    if (!thinking) return [];

    // Split by sentences or line breaks
    const thoughts = thinking
      .split(/[.!?]\s+|\n+/)
      .map(t => t.trim())
      .filter(t => t.length > 10);  // Filter out very short fragments

    // Limit to reasonable number of thoughts
    return thoughts.slice(0, 5);
  }

  /**
   * Copy message content to clipboard
   */
  copyMessage(message: ChatMessage): void {
    navigator.clipboard.writeText(message.content).then(() => {
      // Could show a toast notification here
      console.log('Copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  private scrollToBottom(): void {
    try {
      const container = this.messagesContainer?.nativeElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    } catch (err) {}
  }

  private focusInput(): void {
    try {
      this.messageInput?.nativeElement?.focus();
    } catch (err) {}
  }
}
