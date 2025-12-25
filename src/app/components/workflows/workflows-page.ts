// src/app/components/workflows/workflows-page.ts
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { WorkflowService } from '../../services/workflow.service';
import { WorkflowSummary, WorkflowCreate } from '../../models/workflow';

@Component({
  selector: 'app-workflows-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TableModule,
    TagModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    TooltipModule,
    ConfirmDialogModule,
    ToastModule
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './workflows-page.html',
  styleUrl: './workflows-page.scss'
})
export class WorkflowsPageComponent implements OnInit {
  showCreateDialog = signal(false);
  newWorkflow: WorkflowCreate = { name: '', description: '' };

  constructor(
    public workflowService: WorkflowService,
    private router: Router,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.workflowService.loadWorkflows().subscribe();
  }

  openCreateDialog(): void {
    this.newWorkflow = { name: '', description: '' };
    this.showCreateDialog.set(true);
  }

  createWorkflow(): void {
    if (!this.newWorkflow.name?.trim()) return;

    this.workflowService.createWorkflow(this.newWorkflow).subscribe({
      next: response => {
        this.showCreateDialog.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Επιτυχία',
          detail: 'Το workflow δημιουργήθηκε'
        });

        // Navigate to editor
        if (response.data?.workflow_id) {
          this.router.navigate(['/workflows', response.data.workflow_id]);
        }
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Σφάλμα',
          detail: 'Αποτυχία δημιουργίας workflow'
        });
      }
    });
  }

  editWorkflow(workflow: WorkflowSummary): void {
    this.router.navigate(['/workflows', workflow.id]);
  }

  toggleWorkflow(workflow: WorkflowSummary): void {
    const action = workflow.is_enabled
      ? this.workflowService.disableWorkflow(workflow.id)
      : this.workflowService.enableWorkflow(workflow.id);

    action.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Επιτυχία',
          detail: workflow.is_enabled ? 'Workflow απενεργοποιήθηκε' : 'Workflow ενεργοποιήθηκε'
        });
      }
    });
  }

  runWorkflow(workflow: WorkflowSummary, event: Event): void {
    event.stopPropagation();

    this.workflowService.runWorkflow(workflow.id).subscribe({
      next: response => {
        this.messageService.add({
          severity: 'info',
          summary: 'Εκκίνηση',
          detail: `Workflow ξεκίνησε: ${response.execution_id}`
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Σφάλμα',
          detail: 'Αποτυχία εκκίνησης workflow'
        });
      }
    });
  }

  deleteWorkflow(workflow: WorkflowSummary, event: Event): void {
    event.stopPropagation();

    this.confirmationService.confirm({
      message: `Θέλετε να διαγράψετε το workflow "${workflow.name}";`,
      header: 'Επιβεβαίωση Διαγραφής',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Διαγραφή',
      rejectLabel: 'Άκυρο',
      accept: () => {
        this.workflowService.deleteWorkflow(workflow.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Επιτυχία',
              detail: 'Το workflow διαγράφηκε'
            });
          }
        });
      }
    });
  }

  getStatusSeverity(enabled: boolean): 'success' | 'danger' {
    return enabled ? 'success' : 'danger';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('el-GR');
  }
}
