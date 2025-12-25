// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'chat',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login').then(m => m.LoginComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'chat',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./components/chat-page/chat-page').then(m => m.ChatPageComponent)
      },
      {
        path: ':chatId',
        loadComponent: () => import('./components/chat-page/chat-page').then(m => m.ChatPageComponent)
      }
    ]
  },
  {
    path: 'workflows',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./components/workflows/workflows-page').then(m => m.WorkflowsPageComponent)
      },
      {
        path: ':id',
        loadComponent: () => import('./components/workflows/workflow-editor/workflow-editor').then(m => m.WorkflowEditorComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'chat'
  }
];
