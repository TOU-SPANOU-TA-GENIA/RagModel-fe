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
import { FileService, FileMetadata } from '../../services/file.service';
import { ChatMessage, GeneratedFileInfo } from '../../models/chat';

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
  @ViewChild('fileInput') private fileInput!: ElementRef;

  newMessage = '';
  sending = false;
  useStreaming = true;
  showThinking = true;

  // File handling
  pendingFiles: File[] = [];
  uploadedFileIds: string[] = [];

  private shouldScroll = false;

  constructor(
    public chatService: ChatService,
    private streamingService: StreamingService,
    public fileService: FileService
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
      // Upload pending files first
      if (this.pendingFiles.length > 0) {
        await this.uploadPendingFiles(chatId);
      }

      if (this.useStreaming) {
        await this.streamingService.sendStreamingMessage(
          content,
          chatId,
          this.showThinking,
          this.uploadedFileIds
        );
      } else {
        await this.chatService.sendMessage(content).toPromise();
      }

      // Clear uploaded file IDs after message sent
      this.uploadedFileIds = [];
      this.pendingFiles = [];

    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      this.sending = false;
      this.shouldScroll = true;
      this.focusInput();
    }
  }

  private async uploadPendingFiles(chatId: string): Promise<void> {
    for (const file of this.pendingFiles) {
      try {
        const metadata = await this.fileService.uploadFile(file, chatId).toPromise();
        if (metadata?.file_id) {
          this.uploadedFileIds.push(metadata.file_id);
        }
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
      }
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  trackMessage(index: number, message: ChatMessage): string {
    return `${index}-${message.role}-${message.timestamp || index}`;
  }

  // ==========================================================================
  // File Upload Methods
  // ==========================================================================

  triggerFileUpload(): void {
    this.fileInput?.nativeElement?.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const files = Array.from(input.files);
      this.pendingFiles = [...this.pendingFiles, ...files];
      input.value = '';
    }
  }

  removePendingFile(file: File): void {
    this.pendingFiles = this.pendingFiles.filter(f => f !== file);
  }

  // ==========================================================================
  // File Download Methods
  // ==========================================================================

  downloadFile(file: FileMetadata): void {
    this.fileService.downloadFile(file.file_id, file.original_name);
  }

  downloadGeneratedFile(file: GeneratedFileInfo): void {
    this.fileService.downloadFile(file.file_id, file.filename);
  }

  // ==========================================================================
  // Thinking Toggle
  // ==========================================================================

  toggleThinking(): void {
    this.showThinking = !this.showThinking;
  }

  toggleMessageThinking(message: ChatMessage): void {
    message.thinkingExpanded = !message.thinkingExpanded;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  copyMessage(message: ChatMessage): void {
    navigator.clipboard.writeText(message.content).then(() => {
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
