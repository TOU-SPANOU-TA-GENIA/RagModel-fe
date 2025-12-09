// src/app/services/file.service.ts
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, throwError } from 'rxjs';
import { catchError, map, tap, filter } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface FileMetadata {
  file_id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  upload_time?: string;
  content_type: string;
  has_content?: boolean;
  extracted_preview?: string;
}

export interface UploadProgress {
  file_id?: string;
  filename: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export interface GeneratedFile {
  file_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  download_url: string;
}

@Injectable({
  providedIn: 'root'
})
export class FileService {
  private apiUrl = environment.apiUrl;

  // State signals
  private _uploads = signal<UploadProgress[]>([]);
  private _chatFiles = signal<FileMetadata[]>([]);
  private _isUploading = signal(false);

  // Public readonly signals
  readonly uploads = this._uploads.asReadonly();
  readonly chatFiles = this._chatFiles.asReadonly();
  readonly isUploading = this._isUploading.asReadonly();

  // Computed
  readonly hasActiveUploads = computed(() =>
    this._uploads().some(u => u.status === 'uploading')
  );

  constructor(private http: HttpClient) {}

  /**
   * Upload a file to the backend
   */
  uploadFile(file: File, chatId?: string): Observable<FileMetadata> {
    const formData = new FormData();
    formData.append('file', file);

    let url = `${this.apiUrl}/files/upload`;
    if (chatId) {
      url += `?chat_id=${chatId}`;
    }

    // Add to uploads tracking
    const uploadEntry: UploadProgress = {
      filename: file.name,
      progress: 0,
      status: 'uploading'
    };
    this._uploads.update(uploads => [...uploads, uploadEntry]);
    this._isUploading.set(true);

    return this.http.post<FileMetadata>(url, formData, {
      reportProgress: true,
      observe: 'events'
    }).pipe(
      map(event => this.handleUploadEvent(event, file.name)),
      filter((result): result is FileMetadata => result !== null),
      tap(metadata => {
        // Update upload status
        this._uploads.update(uploads =>
          uploads.map(u =>
            u.filename === file.name
              ? { ...u, file_id: metadata.file_id, progress: 100, status: 'completed' as const }
              : u
          )
        );
        this._isUploading.set(false);

        // Add to chat files
        this._chatFiles.update(files => [...files, metadata]);
      }),
      catchError(error => {
        this._uploads.update(uploads =>
          uploads.map(u =>
            u.filename === file.name
              ? { ...u, status: 'error' as const, error: error.message }
              : u
          )
        );
        this._isUploading.set(false);
        return throwError(() => error);
      })
    );
  }

  private handleUploadEvent(event: HttpEvent<any>, filename: string): FileMetadata | null {
    switch (event.type) {
      case HttpEventType.UploadProgress:
        if (event.total) {
          const progress = Math.round(100 * event.loaded / event.total);
          this._uploads.update(uploads =>
            uploads.map(u =>
              u.filename === filename ? { ...u, progress } : u
            )
          );
        }
        return null;

      case HttpEventType.Response:
        return event.body as FileMetadata;

      default:
        return null;
    }
  }

  /**
   * Download a file by ID - triggers browser download
   */
  downloadFile(fileId: string, filename: string): void {
    const url = `${this.apiUrl}/files/download/${fileId}`;

    this.http.get(url, {
      responseType: 'blob',
      observe: 'response'
    }).subscribe({
      next: (response) => {
        const blob = response.body;
        if (blob) {
          this.triggerDownload(blob, filename);
        }
      },
      error: (error) => {
        console.error('Download failed:', error);
      }
    });
  }

  /**
   * Trigger browser download for a blob
   */
  triggerDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Get file content (extracted text)
   */
  getFileContent(fileId: string): Observable<{ content: string; content_type: string }> {
    return this.http.get<{ content: string; content_type: string }>(
      `${this.apiUrl}/files/content/${fileId}`
    );
  }

  /**
   * Get files for a chat
   */
  getChatFiles(chatId: string): Observable<FileMetadata[]> {
    return this.http.get<FileMetadata[]>(`${this.apiUrl}/files/chat/${chatId}`).pipe(
      tap(files => this._chatFiles.set(files))
    );
  }

  /**
   * Generate a new file (docx, xlsx, pdf, etc.)
   */
  generateFile(
    content: string,
    fileType: string = 'docx',
    title?: string,
    filename?: string
  ): Observable<GeneratedFile> {
    return this.http.post<GeneratedFile>(`${this.apiUrl}/files/generate`, {
      content,
      file_type: fileType,
      title,
      filename
    });
  }

  /**
   * Generate and immediately download a file
   */
  generateAndDownload(
    content: string,
    fileType: string = 'docx',
    title?: string,
    filename?: string
  ): void {
    this.http.post(`${this.apiUrl}/files/generate-direct`, {
      content,
      file_type: fileType,
      title,
      filename
    }, {
      responseType: 'blob',
      observe: 'response'
    }).subscribe({
      next: (response) => {
        const blob = response.body;
        const contentDisposition = response.headers.get('Content-Disposition');
        let downloadFilename = filename || `document.${fileType}`;

        // Extract filename from Content-Disposition if available
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?([^"]+)"?/);
          if (match) {
            downloadFilename = match[1];
          }
        }

        if (blob) {
          this.triggerDownload(blob, downloadFilename);
        }
      },
      error: (error) => {
        console.error('Generate and download failed:', error);
      }
    });
  }

  /**
   * Delete a file
   */
  deleteFile(fileId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/files/${fileId}`).pipe(
      tap(() => {
        this._chatFiles.update(files => files.filter(f => f.file_id !== fileId));
        this._uploads.update(uploads => uploads.filter(u => u.file_id !== fileId));
      })
    );
  }

  /**
   * Clear completed uploads from the list
   */
  clearCompletedUploads(): void {
    this._uploads.update(uploads =>
      uploads.filter(u => u.status !== 'completed')
    );
  }

  /**
   * Clear all state for chat switch
   */
  clearState(): void {
    this._chatFiles.set([]);
    this._uploads.set([]);
    this._isUploading.set(false);
  }
}
