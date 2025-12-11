// src/app/services/logistics.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Update this to match your environment configuration
const API_URL = 'http://localhost:8000';

// =============================================================================
// Interfaces
// =============================================================================

export interface UploadedFile {
  filename: string;
  path: string;
  size_bytes: number;
  content_type: string;
}

export interface UploadResponse {
  success: boolean;
  session_id: string;
  files: UploadedFile[];
  total_size_bytes: number;
}

export interface Anomaly {
  anomaly_id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  description: string;
  source_documents: string[];
  evidence: string[];
  suggested_actions: string[];
  confidence: number;
}

export interface AnalysisResponse {
  success: boolean;
  documents_analyzed: number;
  entities_found: number;
  anomaly_count: number;
  severity_breakdown: Record<string, number>;
  category_breakdown: Record<string, number>;
  confidence_score: string;
  recommendations: string[];
  anomalies?: Anomaly[];
  report_path?: string;
  report_name?: string;
  download_url?: string;
  error?: string;
}

export interface ComparisonChange {
  entity_type: string;
  entity_name: string;
  baseline_value: number;
  comparison_value: number;
  change: number;
  change_pct: string;
  baseline_source: string[];
  comparison_source: string[];
  match_confidence: number;
}

export interface ComparisonResponse {
  success: boolean;
  summary: {
    total_baseline_entities: number;
    total_comparison_entities: number;
    matched_pairs: number;
    changes_detected: number;
    increases: number;
    decreases: number;
  };
  changes: ComparisonChange[];
  error?: string;
}

export interface AnomalyCategory {
  id: string;
  name: string;
  description: string;
}

export interface SeverityLevel {
  id: string;
  name: string;
  priority: number;
}

// =============================================================================
// Service
// =============================================================================

@Injectable({
  providedIn: 'root'
})
export class LogisticsService {
  private http = inject(HttpClient);
  private baseUrl = `${API_URL}/logistics`;

  /**
   * Upload documents for logistics analysis.
   */
  uploadDocuments(files: File[]): Observable<UploadResponse> {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    return this.http.post<UploadResponse>(`${this.baseUrl}/upload`, formData);
  }

  /**
   * Analyze uploaded documents for anomalies.
   */
  analyzeDocuments(
    filePaths: string[],
    options: {
      generateReport?: boolean;
      reportFormat?: 'docx' | 'pdf' | 'md';
      includeEvidence?: boolean;
    } = {}
  ): Observable<AnalysisResponse> {
    const body = {
      file_paths: filePaths,
      generate_report: options.generateReport ?? true,
      report_format: options.reportFormat ?? 'docx',
      include_evidence: options.includeEvidence ?? true
    };

    return this.http.post<AnalysisResponse>(`${this.baseUrl}/analyze`, body);
  }

  /**
   * Compare two sets of documents.
   */
  compareDocuments(
    baselineFiles: string[],
    comparisonFiles: string[]
  ): Observable<ComparisonResponse> {
    return this.http.post<ComparisonResponse>(`${this.baseUrl}/compare`, {
      baseline_files: baselineFiles,
      comparison_files: comparisonFiles
    });
  }

  /**
   * Download generated audit report.
   */
  downloadReport(filename: string): void {
    const url = `${this.baseUrl}/download/${filename}`;
    window.open(url, '_blank');
  }

  /**
   * Clean up uploaded files for a session.
   */
  cleanupSession(sessionId: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.baseUrl}/session/${sessionId}`
    );
  }

  /**
   * Get available anomaly categories and severities.
   */
  getCategories(): Observable<{
    categories: AnomalyCategory[];
    severities: SeverityLevel[];
  }> {
    return this.http.get<{
      categories: AnomalyCategory[];
      severities: SeverityLevel[];
    }>(`${this.baseUrl}/categories`);
  }

  /**
   * Get severity icon based on level.
   */
  getSeverityIcon(severity: string): string {
    const icons: Record<string, string> = {
      critical: 'pi-exclamation-circle',
      high: 'pi-exclamation-triangle',
      medium: 'pi-info-circle',
      low: 'pi-check-circle',
      info: 'pi-info'
    };
    return icons[severity] || 'pi-question-circle';
  }

  /**
   * Get severity color class.
   */
  getSeverityClass(severity: string): string {
    const classes: Record<string, string> = {
      critical: 'text-red-500',
      high: 'text-orange-500',
      medium: 'text-yellow-500',
      low: 'text-green-500',
      info: 'text-blue-500'
    };
    return classes[severity] || 'text-gray-500';
  }

  /**
   * Get category display name in Greek.
   */
  getCategoryName(category: string): string {
    const names: Record<string, string> = {
      inventory_discrepancy: 'Ασυμφωνία Αποθέματος',
      budget_anomaly: 'Ανωμαλία Προϋπολογισμού',
      supply_chain_gap: 'Κενό Εφοδιαστικής',
      resource_conflict: 'Σύγκρουση Πόρων',
      maintenance_pattern: 'Μοτίβο Συντήρησης',
      expiration_warning: 'Προειδοποίηση Λήξης',
      usage_anomaly: 'Ανωμαλία Χρήσης',
      documentation_mismatch: 'Ασυμφωνία Εγγράφων'
    };
    return names[category] || category;
  }
}
