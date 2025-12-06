// src/app/components/sidebar/sidebar.ts
import { Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { ChatListComponent } from '../chat-list/chat-list';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TooltipModule,
    AvatarModule,
    MenuModule,
    ChatListComponent
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class SidebarComponent {
  newChatClick = output<void>();

  userMenuItems: MenuItem[] = [
    {
      label: 'Αποσύνδεση',
      icon: 'pi pi-sign-out',
      command: () => this.logout()
    }
  ];

  constructor(
    public authService: AuthService,
    private chatService: ChatService
  ) {}

  /**
   * Create new chat.
   * The chatService.createChat() now handles both creation AND navigation.
   */
  onNewChat(): void {
    this.chatService.createChat().subscribe({
      error: err => console.error('Failed to create chat:', err)
    });
  }

  logout(): void {
    this.chatService.clearState();
    this.authService.logout();
  }

  getUserInitial(): string {
    const user = this.authService.currentUser();
    return user?.username?.charAt(0).toUpperCase() || '?';
  }
}
