import { Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule, AvatarModule, MenuModule],
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

  onNewChat(): void {
    this.chatService.createChat().subscribe();
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
