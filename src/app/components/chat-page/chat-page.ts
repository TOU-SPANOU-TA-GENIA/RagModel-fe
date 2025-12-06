// src/app/components/chat-page/chat-page.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ChatWindowComponent } from '../chat-window/chat-window';
import { ChatService } from '../../services/chat.service';

/**
 * Chat page component that handles route-based chat selection.
 * Generic approach: reads chatId from route and syncs with service.
 */
@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [CommonModule, ChatWindowComponent],
  template: `<app-chat-window />`
})
export class ChatPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private chatService: ChatService
  ) {}

  ngOnInit(): void {
    // React to route parameter changes
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const chatId = params.get('chatId');

        if (chatId) {
          // Set active chat from route
          this.chatService.setActiveChat(chatId);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
