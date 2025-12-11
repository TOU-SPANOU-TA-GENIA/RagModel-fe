// src/app/components/logistics-audit/logistics-audit.component.ts
import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG 20 imports - using correct module paths
import { Card } from 'primeng/card';
import { Button } from 'primeng/button';
import { FileUpload } from 'primeng/fileupload';
import { ProgressSpinner } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { Accordion, AccordionContent, AccordionHeader, AccordionPanel } from 'primeng/accordion';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Checkbox } from 'primeng/checkbox';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { ChartModule } from 'primeng/chart';

import { LogisticsService, AnalysisResponse, Anomaly, UploadResponse } from '../../services/logistics.service';

interface UploadedFileInfo {
  name: string;
  path: string;
  size: number;
}

@Component({
  selector: 'app-logistics-audit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    // PrimeNG 20 components
    Card,
    Button,
    FileUpload,
    ProgressSpinner,
    TableModule,
    Tag,
    Tooltip,
    Accordion,
    AccordionContent,
    AccordionHeader,
    AccordionPanel,
    Message,
    Select,
    Checkbox,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    ChartModule
  ],
  templateUrl: './logistics-audit.component.html',
  styleUrl: './logistics-audit.component.scss'
})
export class LogisticsAuditComponent implements OnDestroy {
  // Services
  private logisticsService = inject(LogisticsService);

  // State signals
  uploadedFiles = signal<UploadedFileInfo[]>([]);
  sessionId = signal<string>('');
  analysisResult = signal<AnalysisResponse | null>(null);
  error = signal<string>('');

  // Loading states
  isUploading = signal(false);
  isAnalyzing = signal(false);

  // Options
  reportFormat = signal<'docx' | 'pdf' | 'md'>('docx');
  generateReport = signal(true);
  includeEvidence = signal(true);

  // Computed values
  hasFiles = computed(() => this.uploadedFiles().length > 0);
  canAnalyze = computed(() => this.hasFiles() && !this.isAnalyzing());

  criticalCount = computed(() =>
    this.analysisResult()?.severity_breakdown?.['critical'] || 0
  );

  highCount = computed(() =>
    this.analysisResult()?.severity_breakdown?.['high'] || 0
  );

  // Chart data for severity breakdown
  severityChartData = computed(() => {
    const result = this.analysisResult();
    if (!result?.severity_breakdown) return null;

    return {
      labels: Object.keys(result.severity_breakdown).map(k => this.getSeverityLabel(k)),
      datasets: [{
        data: Object.values(result.severity_breakdown),
        backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6']
      }]
    };
  });

  categoryChartData = computed(() => {
    const result = this.analysisResult();
    if (!result?.category_breakdown) return null;

    return {
      labels: Object.keys(result.category_breakdown).map(k =>
        this.logisticsService.getCategoryName(k)
      ),
      datasets: [{
        label: 'Ευρήματα ανά κατηγορία',
        data: Object.values(result.category_breakdown),
        backgroundColor: '#00e5ff'
      }]
    };
  });

  // Report format options for Select component
  formatOptions = [
    { label: 'Word (DOCX)', value: 'docx' },
    { label: 'PDF', value: 'pdf' },
    { label: 'Markdown', value: 'md' }
  ];

  // ==========================================================================
  // File Upload
  // ==========================================================================

  onFilesSelected(event: any): void {
    const files: File[] = event.files || [];
    if (!files.length) return;

    this.isUploading.set(true);
    this.error.set('');

    this.logisticsService.uploadDocuments(files).subscribe({
      next: (response: UploadResponse) => {
        this.sessionId.set(response.session_id);
        this.uploadedFiles.set(
          response.files.map(f => ({
            name: f.filename,
            path: f.path,
            size: f.size_bytes
          }))
        );
        this.isUploading.set(false);
      },
      error: (err) => {
        this.error.set('Αποτυχία μεταφόρτωσης αρχείων');
        this.isUploading.set(false);
        console.error('Upload error:', err);
      }
    });
  }

  removeFile(file: UploadedFileInfo): void {
    this.uploadedFiles.update(files => files.filter(f => f.path !== file.path));
  }

  clearFiles(): void {
    if (this.sessionId()) {
      this.logisticsService.cleanupSession(this.sessionId()).subscribe();
    }

    this.uploadedFiles.set([]);
    this.sessionId.set('');
    this.analysisResult.set(null);
  }

  // ==========================================================================
  // Analysis
  // ==========================================================================

  analyze(): void {
    if (!this.canAnalyze()) return;

    this.isAnalyzing.set(true);
    this.error.set('');
    this.analysisResult.set(null);

    const filePaths = this.uploadedFiles().map(f => f.path);

    this.logisticsService.analyzeDocuments(filePaths, {
      generateReport: this.generateReport(),
      reportFormat: this.reportFormat(),
      includeEvidence: this.includeEvidence()
    }).subscribe({
      next: (response: AnalysisResponse) => {
        if (response.success) {
          this.analysisResult.set(response);
        } else {
          this.error.set(response.error || 'Άγνωστο σφάλμα');
        }
        this.isAnalyzing.set(false);
      },
      error: (err) => {
        this.error.set('Αποτυχία ανάλυσης εγγράφων');
        this.isAnalyzing.set(false);
        console.error('Analysis error:', err);
      }
    });
  }

  // ==========================================================================
  // Report Download
  // ==========================================================================

  downloadReport(): void {
    const result = this.analysisResult();
    if (result?.report_name) {
      this.logisticsService.downloadReport(result.report_name);
    }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  // PrimeNG 20 Tag severity types: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'
  getSeverityTag(severity: string): 'danger' | 'warn' | 'info' | 'success' | 'secondary' {
    const map: Record<string, 'danger' | 'warn' | 'info' | 'success' | 'secondary'> = {
      critical: 'danger',
      high: 'warn',      // Changed from 'warning' to 'warn'
      medium: 'info',
      low: 'success',
      info: 'secondary'
    };
    return map[severity] || 'secondary';
  }

  getSeverityLabel(severity: string): string {
    const labels: Record<string, string> = {
      critical: 'Κρίσιμο',
      high: 'Υψηλό',
      medium: 'Μεσαίο',
      low: 'Χαμηλό',
      info: 'Πληροφορία'
    };
    return labels[severity] || severity;
  }

  getSeverityIcon(severity: string): string {
    return this.logisticsService.getSeverityIcon(severity);
  }

  getCategoryName(category: string): string {
    return this.logisticsService.getCategoryName(category);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  trackAnomaly(index: number, anomaly: Anomaly): string {
    return anomaly.anomaly_id;
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  ngOnDestroy(): void {
    if (this.sessionId()) {
      this.logisticsService.cleanupSession(this.sessionId()).subscribe();
    }
  }
}
