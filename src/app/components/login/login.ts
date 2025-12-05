import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { TabsModule } from 'primeng/tabs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    MessageModule,
    TabsModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  // Login form
  loginUsername = '';
  loginPassword = '';

  // Register form
  registerUsername = '';
  registerEmail = '';
  registerPassword = '';
  registerConfirmPassword = '';

  // State
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  activeTab = signal(0);

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onLogin(): void {
    if (!this.loginUsername || !this.loginPassword) {
      this.error.set('Συμπλήρωσε όλα τα πεδία');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.authService.login({
      username: this.loginUsername,
      password: this.loginPassword
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/chat']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.message || 'Σφάλμα σύνδεσης');
      }
    });
  }

  onRegister(): void {
    if (!this.registerUsername || !this.registerEmail || !this.registerPassword) {
      this.error.set('Συμπλήρωσε όλα τα πεδία');
      return;
    }

    if (this.registerPassword !== this.registerConfirmPassword) {
      this.error.set('Οι κωδικοί δεν ταιριάζουν');
      return;
    }

    if (this.registerPassword.length < 6) {
      this.error.set('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.authService.register({
      username: this.registerUsername,
      email: this.registerEmail,
      password: this.registerPassword
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set('Επιτυχής εγγραφή! Μπορείς να συνδεθείς.');
        this.activeTab.set(0);
        // Clear register form
        this.registerUsername = '';
        this.registerEmail = '';
        this.registerPassword = '';
        this.registerConfirmPassword = '';
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.message || 'Σφάλμα εγγραφής');
      }
    });
  }

  onTabChange(index: number): void {
    this.activeTab.set(index);
    this.error.set(null);
    this.success.set(null);
  }
}
