// src/app/services/auth.service.ts
import { Injectable, signal, computed, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import {
  User,
  LoginRequest,
  RegisterRequest,
  LoginResponse,
  AuthState
} from '../models/chat';
import { environment } from '../../environments/environment';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = environment.apiUrl;
  private platformId = inject(PLATFORM_ID);

  // Reactive state using signals
  private authState = signal<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null
  });

  // Public computed signals
  readonly isAuthenticated = computed(() => this.authState().isAuthenticated);
  readonly currentUser = computed(() => this.authState().user);
  readonly token = computed(() => this.authState().token);

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.loadStoredAuth();
  }

  /**
   * Check if running in browser environment
   */
  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  /**
   * Load authentication state from localStorage on app init
   */
  private loadStoredAuth(): void {
    if (!this.isBrowser()) {
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    const userJson = localStorage.getItem(USER_KEY);

    if (token && userJson) {
      try {
        const user = JSON.parse(userJson) as User;
        this.authState.set({
          isAuthenticated: true,
          user,
          token
        });
      } catch {
        this.clearAuth();
      }
    }
  }

  /**
   * Register a new user
   */
  register(request: RegisterRequest): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/auth/register`, request).pipe(
      catchError(error => {
        const message = error.error?.detail || 'Η εγγραφή απέτυχε';
        return throwError(() => new Error(message));
      })
    );
  }

  /**
   * Login with username and password
   */
  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, request).pipe(
      tap(response => {
        this.setAuth(response.access_token, response.user);
      }),
      catchError(error => {
        const message = error.error?.detail || 'Λάθος όνομα χρήστη ή κωδικός';
        return throwError(() => new Error(message));
      })
    );
  }

  /**
   * Get current user info from server
   */
  getMe(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/auth/me`);
  }

  /**
   * Logout and clear all auth state
   */
  logout(): void {
    this.http.post(`${this.apiUrl}/auth/logout`, {}).subscribe({
      complete: () => {
        this.clearAuth();
        this.router.navigate(['/login']);
      },
      error: () => {
        this.clearAuth();
        this.router.navigate(['/login']);
      }
    });
  }

  /**
   * Set authentication state and persist to storage
   */
  private setAuth(token: string, user: User): void {
    if (this.isBrowser()) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }

    this.authState.set({
      isAuthenticated: true,
      user,
      token
    });
  }

  /**
   * Clear all authentication state
   */
  private clearAuth(): void {
    if (this.isBrowser()) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }

    this.authState.set({
      isAuthenticated: false,
      user: null,
      token: null
    });
  }

  /**
   * Get token for HTTP interceptor
   */
  getToken(): string | null {
    return this.authState().token;
  }
}
