import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { ChatService } from '../../services/chat.service';
import { ChatSummary } from '../../models/chat';

@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule, ConfirmDialogModule],
  providers: [ConfirmationService],
  templateUrl: './chat-list.html',
  styleUrl: './chat-list.scss'
})
export class ChatListComponent implements OnInit {
  constructor(
    public chatService: ChatService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.chatService.loadChats().subscribe();
  }

  selectChat(chat: ChatSummary): void {
    this.chatService.setActiveChat(chat.id);
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

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
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
  }
}
