// src/app/components/chat-list/chat-list.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmationService } from 'primeng/api';
import { ChatService } from '../../services/chat.service';
import { ChatSummary } from '../../models/chat';

@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TooltipModule,
    ConfirmDialogModule,
    InputTextModule
  ],
  providers: [ConfirmationService],
  templateUrl: './chat-list.html',
  styleUrl: './chat-list.scss'
})
export class ChatListComponent implements OnInit {
  editingChatId: string | null = null;
  editingTitle: string = '';

  constructor(
    public chatService: ChatService,
    private confirmationService: ConfirmationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.chatService.loadChats().subscribe();
  }

  selectChat(chat: ChatSummary): void {
    if (this.editingChatId === chat.id) return;
    this.chatService.setActiveChat(chat.id);
    this.chatService.navigateToChat(chat.id);
  }

  startEditing(event: Event, chat: ChatSummary): void {
    event.stopPropagation();
    this.editingChatId = chat.id;
    this.editingTitle = chat.title;
  }

  saveTitle(chat: ChatSummary): void {
    const newTitle = this.editingTitle.trim();
    if (newTitle && newTitle !== chat.title) {
      this.chatService.renameChat(chat.id, newTitle).subscribe({
        error: err => console.error('Failed to rename chat:', err)
      });
    }
    this.cancelEditing();
  }

  cancelEditing(): void {
    this.editingChatId = null;
    this.editingTitle = '';
  }

  onEditKeydown(event: KeyboardEvent, chat: ChatSummary): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.saveTitle(chat);
    } else if (event.key === 'Escape') {
      this.cancelEditing();
    }
  }

  deleteChat(event: Event, chat: ChatSummary): void {
    event.stopPropagation();
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Διαγραφή "${chat.title}";`,
      icon: 'pi pi-trash',
      acceptLabel: 'Ναι',
      rejectLabel: 'Όχι',
      accept: () => {
        this.chatService.deleteChat(chat.id).subscribe();
      }
    });
  }

  formatDate(dateStr: string | undefined): string {
    // Handle undefined or null dates
    if (!dateStr) {
      return '';
    }

    try {
      const date = new Date(dateStr);

      // Check for invalid date
      if (isNaN(date.getTime())) {
        return '';
      }

      const now = new Date();
      const diff = now.getTime() - date.getTime();

      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return 'Τώρα';
      if (minutes < 60) return `${minutes} λεπτά πριν`;
      if (hours < 24) return `${hours} ώρες πριν`;
      if (days < 7) return `${days} μέρες πριν`;

      return date.toLocaleDateString('el-GR');
    } catch {
      return '';
    }
  }
}
