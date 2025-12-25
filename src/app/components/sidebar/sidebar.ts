// src/app/components/sidebar/sidebar.ts
import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { Subject, takeUntil, filter } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { RippleModule } from 'primeng/ripple';
import { MenuItem } from 'primeng/api';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { ChatListComponent } from '../chat-list/chat-list';

type NavSection = 'chat' | 'workflows';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ButtonModule,
    TooltipModule,
    AvatarModule,
    MenuModule,
    RippleModule,
    ChatListComponent
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class SidebarComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeSection = signal<NavSection>('chat');

  userMenuItems: MenuItem[] = [
    {
      label: 'Αποσύνδεση',
      icon: 'pi pi-sign-out',
      command: () => this.logout()
    }
  ];

  constructor(
    public authService: AuthService,
    private chatService: ChatService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Detect current section from URL on init
    this.detectActiveSection(this.router.url);

    // Listen for route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((event: NavigationEnd) => {
      this.detectActiveSection(event.urlAfterRedirects);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private detectActiveSection(url: string): void {
    if (url.includes('/workflows')) {
      this.activeSection.set('workflows');
    } else {
      this.activeSection.set('chat');
    }
  }

  navigateTo(section: NavSection): void {
    this.activeSection.set(section);

    switch (section) {
      case 'chat':
        this.router.navigate(['/chat']);
        break;
      case 'workflows':
        this.router.navigate(['/workflows']);
        break;
    }
  }

  onNewChat(): void {
    this.activeSection.set('chat');
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
