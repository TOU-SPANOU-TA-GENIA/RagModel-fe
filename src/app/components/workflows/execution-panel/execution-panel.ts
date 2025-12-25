// src/app/components/workflows/execution-panel/execution-panel.ts
import { Component, Input, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe, JsonPipe } from '@angular/common';
import { Subject, interval, takeUntil, switchMap, filter } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { TimelineModule } from 'primeng/timeline';
import { WorkflowService } from '../../../services/workflow.service';
import { Execution, ExecutionStatus, NodeLog } from '../../../models/workflow';

@Component({
  selector: 'app-execution-panel',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    ProgressBarModule,
    TagModule,
    TooltipModule,
    DialogModule,
    TimelineModule
  ],
  template: `
    <div class="execution-panel" [class.minimized]="minimized()">
      <!-- Header -->
      <div class="panel-header" (click)="toggleMinimized()">
        <div class="header-left">
          <i class="pi pi-play-circle"></i>
          <span>Εκτέλεση</span>
          @if (currentExecution()) {
            <p-tag [value]="getStatusLabel(currentExecution()!.status)"
                   [severity]="getStatusSeverity(currentExecution()!.status)" />
          }
        </div>
        <div class="header-right">
          <i class="pi" [class.pi-chevron-down]="!minimized()" [class.pi-chevron-up]="minimized()"></i>
        </div>
      </div>

      @if (!minimized() && currentExecution()) {
        <div class="panel-body">
          <!-- Progress -->
          <div class="progress-section">
            <div class="progress-info">
              <span>{{ completedNodes().length }} / {{ totalNodes() }} κόμβοι</span>
              <span>{{ progressPercent() | number:'1.0-0' }}%</span>
            </div>
            <p-progressBar [value]="progressPercent()" [showValue]="false" />
          </div>

          <!-- Timeline -->
          <div class="timeline-section">
            <p-timeline [value]="timelineEvents()" align="left" styleClass="execution-timeline">
              <ng-template #content let-event>
                <div class="timeline-event" [class]="event.status">
                  <div class="event-header">
                    <span class="node-name">{{ event.nodeName }}</span>
                    <p-tag [value]="event.statusLabel" [severity]="event.severity" size="small" />
                  </div>
                  @if (event.duration) {
                    <span class="event-duration">{{ event.duration }}ms</span>
                  }
                  @if (event.error) {
                    <span class="event-error">{{ event.error }}</span>
                  }
                </div>
              </ng-template>
              <ng-template #marker let-event>
                <span class="timeline-marker" [class]="event.status">
                  <i class="pi" [class]="getMarkerIcon(event.status)"></i>
                </span>
              </ng-template>
            </p-timeline>
          </div>

          <!-- Actions -->
          <div class="panel-actions">
            @if (isRunning()) {
              <p-button icon="pi pi-pause" label="Παύση" severity="warn" size="small"
                        (onClick)="pauseExecution()" />
              <p-button icon="pi pi-times" label="Ακύρωση" severity="danger" size="small"
                        (onClick)="cancelExecution()" />
            }
            @if (isPaused()) {
              <p-button icon="pi pi-play" label="Συνέχεια" severity="success" size="small"
                        (onClick)="resumeExecution()" />
              <p-button icon="pi pi-times" label="Ακύρωση" severity="danger" size="small"
                        (onClick)="cancelExecution()" />
            }
            @if (isCompleted() || isFailed() || isCancelled()) {
              <p-button icon="pi pi-refresh" label="Εκτέλεση ξανά" size="small"
                        (onClick)="rerun()" />
              <p-button icon="pi pi-times" label="Κλείσιμο" severity="secondary" size="small"
                        (onClick)="close()" />
            }
          </div>

          <!-- View Details -->
          <div class="view-details">
            <a (click)="showDetails = true">Προβολή λεπτομερειών</a>
          </div>
        </div>
      }
    </div>

    <!-- Details Dialog -->
    <p-dialog header="Λεπτομέρειες Εκτέλεσης" [(visible)]="showDetails"
              [style]="{width: '700px'}" [modal]="true">
      @if (currentExecution()) {
        <div class="execution-details">
          <div class="detail-row">
            <label>ID:</label>
            <code>{{ currentExecution()!.id }}</code>
          </div>
          <div class="detail-row">
            <label>Κατάσταση:</label>
            <p-tag [value]="getStatusLabel(currentExecution()!.status)"
                   [severity]="getStatusSeverity(currentExecution()!.status)" />
          </div>
          <div class="detail-row">
            <label>Έναρξη:</label>
            <span>{{ currentExecution()!.started_at | date:'dd/MM/yyyy HH:mm:ss' }}</span>
          </div>
          @if (currentExecution()!.completed_at) {
            <div class="detail-row">
              <label>Ολοκλήρωση:</label>
              <span>{{ currentExecution()!.completed_at | date:'dd/MM/yyyy HH:mm:ss' }}</span>
            </div>
          }
          @if (currentExecution()!.error_message) {
            <div class="detail-row error">
              <label>Σφάλμα:</label>
              <span>{{ currentExecution()!.error_message }}</span>
            </div>
          }

          <h4>Node Logs</h4>
          <div class="node-logs">
            @for (log of currentExecution()!.node_logs || []; track log.id) {
              <div class="log-entry" [class]="log.status">
                <div class="log-header">
                  <span class="log-node">{{ log.node_id }}</span>
                  <p-tag [value]="log.status" size="small" />
                  @if (log.duration_ms) {
                    <span class="log-duration">{{ log.duration_ms }}ms</span>
                  }
                </div>
                @if (log.error_message) {
                  <div class="log-error">{{ log.error_message }}</div>
                }
                @if (log.output_data) {
                  <details class="log-output">
                    <summary>Output</summary>
                    <pre>{{ log.output_data | json }}</pre>
                  </details>
                }
              </div>
            }
          </div>
        </div>
      }
    </p-dialog>
  `,
  styles: [`
    .execution-panel {
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      width: 350px;
      background: rgba(15, 25, 35, 0.95);
      border: 1px solid rgba(0, 229, 255, 0.3);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      z-index: 1000;
      overflow: hidden;

      &.minimized {
        width: 200px;
      }
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background: rgba(0, 229, 255, 0.1);
      cursor: pointer;

      .header-left {
        display: flex;
        align-items: center;
        gap: 0.5rem;

        i { color: var(--prometheus-cyan, #00e5ff); }
        span { font-weight: 500; }
      }

      .header-right i {
        color: rgba(255, 255, 255, 0.5);
        font-size: 0.8rem;
      }
    }

    .panel-body {
      padding: 1rem;
    }

    .progress-section {
      margin-bottom: 1rem;

      .progress-info {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.5rem;
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.7);
      }
    }

    .timeline-section {
      max-height: 200px;
      overflow-y: auto;
      margin-bottom: 1rem;

      :deep(.execution-timeline) {
        .p-timeline-event-content {
          padding: 0;
        }
      }
    }

    .timeline-event {
      padding: 0.5rem;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 6px;
      margin-bottom: 0.5rem;

      .event-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .node-name {
        font-size: 0.85rem;
        font-weight: 500;
      }

      .event-duration {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.5);
      }

      .event-error {
        font-size: 0.75rem;
        color: #ff6b6b;
        margin-top: 0.25rem;
      }

      &.completed { border-left: 3px solid #4ade80; }
      &.running { border-left: 3px solid #00e5ff; }
      &.failed { border-left: 3px solid #ff6b6b; }
      &.pending { border-left: 3px solid rgba(255, 255, 255, 0.3); }
    }

    .timeline-marker {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.7rem;

      &.completed { background: #4ade80; color: #000; }
      &.running { background: #00e5ff; color: #000; }
      &.failed { background: #ff6b6b; color: #fff; }
      &.pending { background: rgba(255, 255, 255, 0.2); }
    }

    .panel-actions {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .view-details {
      text-align: center;

      a {
        font-size: 0.8rem;
        color: var(--prometheus-cyan, #00e5ff);
        cursor: pointer;
        text-decoration: underline;
      }
    }

    .execution-details {
      .detail-row {
        display: flex;
        gap: 1rem;
        margin-bottom: 0.75rem;

        label {
          width: 100px;
          color: rgba(255, 255, 255, 0.6);
        }

        code {
          background: rgba(0, 0, 0, 0.3);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.85rem;
        }

        &.error span { color: #ff6b6b; }
      }

      h4 {
        margin: 1.5rem 0 1rem;
        color: var(--prometheus-cyan, #00e5ff);
      }

      .node-logs {
        max-height: 300px;
        overflow-y: auto;
      }

      .log-entry {
        padding: 0.75rem;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 6px;
        margin-bottom: 0.5rem;
        border-left: 3px solid rgba(255, 255, 255, 0.2);

        &.completed { border-left-color: #4ade80; }
        &.failed { border-left-color: #ff6b6b; }

        .log-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .log-node { font-weight: 500; }
        .log-duration {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.5);
          margin-left: auto;
        }

        .log-error {
          margin-top: 0.5rem;
          color: #ff6b6b;
          font-size: 0.85rem;
        }

        .log-output {
          margin-top: 0.5rem;

          summary {
            cursor: pointer;
            font-size: 0.8rem;
            color: var(--prometheus-cyan, #00e5ff);
          }

          pre {
            margin: 0.5rem 0 0;
            padding: 0.5rem;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 4px;
            font-size: 0.75rem;
            overflow-x: auto;
          }
        }
      }
    }
  `]
})
export class ExecutionPanelComponent implements OnInit, OnDestroy {
  @Input() workflowId!: string;
  @Input() set executionId(value: any) {
    // Handle both signal and direct value
    const id = typeof value === 'function' ? value() : value;
    if (id && id !== this._executionId()) {
      this._executionId.set(id);
      this.loadExecution(id);
    }
  }
  @Input() workflowNodes: { id: string; label: string }[] = [];

  private destroy$ = new Subject<void>();
  private _executionId = signal<string | null>(null);

  currentExecution = signal<Execution | null>(null);
  minimized = signal(false);
  showDetails = false;

  // Computed
  totalNodes = computed(() => this.workflowNodes.length || 1);

  completedNodes = computed(() =>
    this.currentExecution()?.completed_nodes || []
  );

  progressPercent = computed(() => {
    const total = this.totalNodes();
    const completed = this.completedNodes().length;
    return (completed / total) * 100;
  });

  timelineEvents = computed(() => {
    const execution = this.currentExecution();
    if (!execution) return [];

    const logs = execution.node_logs || [];
    return logs.map(log => {
      const node = this.workflowNodes.find(n => n.id === log.node_id);
      return {
        nodeName: node?.label || log.node_id,
        status: log.status,
        statusLabel: this.getStatusLabel(log.status as ExecutionStatus),
        severity: this.getStatusSeverity(log.status as ExecutionStatus),
        duration: log.duration_ms,
        error: log.error_message
      };
    });
  });

  constructor(private workflowService: WorkflowService) {}

  ngOnInit(): void {
    // Poll for execution updates when running
    interval(2000).pipe(
      takeUntil(this.destroy$),
      filter(() => !!this._executionId() && this.isRunning()),
      switchMap(() => this.workflowService.getExecution(this._executionId()!))
    ).subscribe(execution => {
      this.currentExecution.set(execution);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadExecution(executionId: string): void {
    this._executionId.set(executionId);
    this.minimized.set(false);

    this.workflowService.getExecution(executionId).subscribe(execution => {
      this.currentExecution.set(execution);
    });
  }

  toggleMinimized(): void {
    this.minimized.update(v => !v);
  }

  // Status helpers
  isRunning(): boolean {
    return this.currentExecution()?.status === 'running';
  }

  isPaused(): boolean {
    return this.currentExecution()?.status === 'paused';
  }

  isCompleted(): boolean {
    return this.currentExecution()?.status === 'completed';
  }

  isFailed(): boolean {
    return this.currentExecution()?.status === 'failed';
  }

  isCancelled(): boolean {
    return this.currentExecution()?.status === 'cancelled';
  }

  getStatusLabel(status: ExecutionStatus | string): string {
    const labels: Record<string, string> = {
      pending: 'Αναμονή',
      running: 'Εκτελείται',
      paused: 'Σε παύση',
      completed: 'Ολοκληρώθηκε',
      failed: 'Απέτυχε',
      cancelled: 'Ακυρώθηκε'
    };
    return labels[status] || status;
  }

  getStatusSeverity(status: ExecutionStatus | string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const severities: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      pending: 'secondary',
      running: 'info',
      paused: 'warn',
      completed: 'success',
      failed: 'danger',
      cancelled: 'secondary'
    };
    return severities[status] || 'secondary';
  }

  getMarkerIcon(status: string): string {
    const icons: Record<string, string> = {
      completed: 'pi-check',
      running: 'pi-spin pi-spinner',
      failed: 'pi-times',
      pending: 'pi-circle'
    };
    return icons[status] || 'pi-circle';
  }

  // Actions
  pauseExecution(): void {
    const id = this._executionId();
    if (id) {
      this.workflowService.pauseExecution(id).subscribe();
    }
  }

  resumeExecution(): void {
    const id = this._executionId();
    if (id) {
      this.workflowService.resumeExecution(id).subscribe();
    }
  }

  cancelExecution(): void {
    const id = this._executionId();
    if (id) {
      this.workflowService.cancelExecution(id).subscribe();
    }
  }

  rerun(): void {
    this.workflowService.runWorkflow(this.workflowId).subscribe(response => {
      if (response.execution_id) {
        this.loadExecution(response.execution_id);
      }
    });
  }

  close(): void {
    this.currentExecution.set(null);
    this._executionId.set(null);
  }
}
