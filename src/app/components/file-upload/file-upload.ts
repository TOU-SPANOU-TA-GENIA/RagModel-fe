import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileUploadModule } from 'primeng/fileupload';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [CommonModule, FileUploadModule],
  templateUrl: './file-upload.html',
  styleUrl: './file-upload.scss'
})
export class FileUploadComponent {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  onUpload(event: { files: File[] }): void {
    for (const file of event.files) {
      const formData = new FormData();
      formData.append('file', file);
      this.http.post(`${this.apiUrl}/upload`, formData).subscribe({
        next: (res) => console.log('File uploaded:', res),
        error: (err) => console.error('Upload failed:', err)
      });
    }
  }
}
