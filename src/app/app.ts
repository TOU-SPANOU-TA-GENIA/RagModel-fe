import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './components/sidebar/sidebar';
import { ChatWindowComponent } from './components/chat-window/chat-window';
import { ChatListComponent } from './components/chat-list/chat-list';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    SidebarComponent,
    ChatWindowComponent,
    //ChatListComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  constructor(public authService: AuthService) {}

  ngOnInit(): void {
    // App initialization if needed
  }
}
