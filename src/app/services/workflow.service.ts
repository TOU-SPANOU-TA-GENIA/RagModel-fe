// src/app/services/workflow.service.ts
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Workflow,
  WorkflowSummary,
  WorkflowCreate,
  WorkflowUpdate,
  Execution,
  ExecutionCreate,
  UserSettings,
  EmailSettings,
  NodeTypeDefinitions,
  WorkflowResponse,
  ExecutionResponse
} from '../models/workflow';

@Injectable({
  providedIn: 'root'
})
export class WorkflowService {
  private apiUrl = `${environment.apiUrl}/workflows`;

  // State signals
  private _workflows = signal<WorkflowSummary[]>([]);
  private _activeWorkflow = signal<Workflow | null>(null);
  private _executions = signal<Execution[]>([]);
  private _nodeTypes = signal<NodeTypeDefinitions | null>(null);
  private _loading = signal(false);
  private _error = signal<string | null>(null);

  // Public computed signals
  readonly workflows = this._workflows.asReadonly();
  readonly activeWorkflow = this._activeWorkflow.asReadonly();
  readonly executions = this._executions.asReadonly();
  readonly nodeTypes = this._nodeTypes.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly enabledWorkflows = computed(() =>
    this._workflows().filter(w => w.is_enabled)
  );

  constructor(private http: HttpClient) {
    this.loadNodeTypes();
  }

  // ===========================================================================
  // Workflow CRUD
  // ===========================================================================

  loadWorkflows(includeShared = true, enabledOnly = false): Observable<WorkflowSummary[]> {
    this._loading.set(true);

    const params: any = { include_shared: includeShared };
    if (enabledOnly) params.enabled_only = true;

    return this.http.get<WorkflowSummary[]>(this.apiUrl, { params }).pipe(
      tap(workflows => {
        this._workflows.set(workflows);
        this._loading.set(false);
      }),
      catchError(err => {
        this._loading.set(false);
        this._error.set('Αποτυχία φόρτωσης workflows');
        return throwError(() => err);
      })
    );
  }

  getWorkflow(id: string): Observable<Workflow> {
    this._loading.set(true);

    return this.http.get<Workflow>(`${this.apiUrl}/${id}`).pipe(
      tap(workflow => {
        this._activeWorkflow.set(workflow);
        this._loading.set(false);
      }),
      catchError(err => {
        this._loading.set(false);
        this._error.set('Αποτυχία φόρτωσης workflow');
        return throwError(() => err);
      })
    );
  }

  createWorkflow(data: WorkflowCreate): Observable<WorkflowResponse> {
    return this.http.post<WorkflowResponse>(this.apiUrl, data).pipe(
      tap(() => this.loadWorkflows().subscribe()),
      catchError(err => {
        this._error.set('Αποτυχία δημιουργίας workflow');
        return throwError(() => err);
      })
    );
  }

  updateWorkflow(id: string, data: WorkflowUpdate): Observable<WorkflowResponse> {
    return this.http.put<WorkflowResponse>(`${this.apiUrl}/${id}`, data).pipe(
      tap(() => {
        // Refresh active workflow if it's the one being updated
        if (this._activeWorkflow()?.id === id) {
          this.getWorkflow(id).subscribe();
        }
        this.loadWorkflows().subscribe();
      }),
      catchError(err => {
        this._error.set('Αποτυχία ενημέρωσης workflow');
        return throwError(() => err);
      })
    );
  }

  deleteWorkflow(id: string): Observable<WorkflowResponse> {
    return this.http.delete<WorkflowResponse>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        if (this._activeWorkflow()?.id === id) {
          this._activeWorkflow.set(null);
        }
        this.loadWorkflows().subscribe();
      }),
      catchError(err => {
        this._error.set('Αποτυχία διαγραφής workflow');
        return throwError(() => err);
      })
    );
  }

  enableWorkflow(id: string): Observable<WorkflowResponse> {
    return this.http.post<WorkflowResponse>(`${this.apiUrl}/${id}/enable`, {}).pipe(
      tap(() => this.loadWorkflows().subscribe()),
      catchError(err => {
        this._error.set('Αποτυχία ενεργοποίησης workflow');
        return throwError(() => err);
      })
    );
  }

  disableWorkflow(id: string): Observable<WorkflowResponse> {
    return this.http.post<WorkflowResponse>(`${this.apiUrl}/${id}/disable`, {}).pipe(
      tap(() => this.loadWorkflows().subscribe()),
      catchError(err => {
        this._error.set('Αποτυχία απενεργοποίησης workflow');
        return throwError(() => err);
      })
    );
  }

  // ===========================================================================
  // Execution Management
  // ===========================================================================

  runWorkflow(id: string, data?: Partial<ExecutionCreate>): Observable<ExecutionResponse> {
    // Only send body if data is provided
    const body = data && Object.keys(data).length > 0 ? data : undefined;
    return this.http.post<ExecutionResponse>(`${this.apiUrl}/${id}/run`, body).pipe(
      catchError(err => {
        this._error.set('Αποτυχία εκκίνησης workflow');
        return throwError(() => err);
      })
    );
  }

  loadExecutions(workflowId: string, status?: string, limit = 20): Observable<Execution[]> {
    const params: any = { limit };
    if (status) params.status = status;

    return this.http.get<Execution[]>(`${this.apiUrl}/${workflowId}/executions`, { params }).pipe(
      tap(executions => this._executions.set(executions)),
      catchError(err => {
        this._error.set('Αποτυχία φόρτωσης εκτελέσεων');
        return throwError(() => err);
      })
    );
  }

  getExecution(executionId: string): Observable<Execution> {
    return this.http.get<Execution>(`${this.apiUrl}/executions/${executionId}`).pipe(
      catchError(err => {
        this._error.set('Αποτυχία φόρτωσης εκτέλεσης');
        return throwError(() => err);
      })
    );
  }

  pauseExecution(executionId: string): Observable<ExecutionResponse> {
    return this.http.post<ExecutionResponse>(
      `${this.apiUrl}/executions/${executionId}/pause`,
      {}
    );
  }

  resumeExecution(executionId: string): Observable<ExecutionResponse> {
    return this.http.post<ExecutionResponse>(
      `${this.apiUrl}/executions/${executionId}/resume`,
      {}
    );
  }

  cancelExecution(executionId: string): Observable<ExecutionResponse> {
    return this.http.post<ExecutionResponse>(
      `${this.apiUrl}/executions/${executionId}/cancel`,
      {}
    );
  }

  // ===========================================================================
  // Settings
  // ===========================================================================

  getEmailSettings(): Observable<UserSettings> {
    return this.http.get<UserSettings>(`${this.apiUrl}/settings/email`);
  }

  updateEmailSettings(settings: EmailSettings): Observable<WorkflowResponse> {
    return this.http.put<WorkflowResponse>(`${this.apiUrl}/settings/email`, settings);
  }

  testEmailSettings(): Observable<WorkflowResponse> {
    return this.http.post<WorkflowResponse>(`${this.apiUrl}/settings/email/test`, {});
  }

  // ===========================================================================
  // Node Types
  // ===========================================================================

  loadNodeTypes(): void {
    this.http.get<NodeTypeDefinitions>(`${this.apiUrl}/node-types`).subscribe({
      next: types => this._nodeTypes.set(types),
      error: () => this._error.set('Αποτυχία φόρτωσης τύπων κόμβων')
    });
  }

  // ===========================================================================
  // Local State Management
  // ===========================================================================

  setActiveWorkflow(workflow: Workflow | null): void {
    this._activeWorkflow.set(workflow);
  }

  clearError(): void {
    this._error.set(null);
  }
}
