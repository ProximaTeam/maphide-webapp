import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api/api';
import { from, Observable } from 'rxjs';

export type PresignedUrlResponse = {
  url: string;
  key: string;
  expiresIn: number;
};

@Injectable({ providedIn: 'root' })
export class FileService {
  private api = inject(ApiService);

  /**
   * Ask backend for a presigned PUT URL for a specific fileId.
   * contentType should match the file's MIME type (e.g. application/pdf).
   * ext is optional (".pdf") but helpful.
   */
  getUploadPresignedUrl(
    fileId: string,
    contentType: string,
    ext?: string,
  ): Observable<PresignedUrlResponse> {
    const qs = new URLSearchParams();
    qs.set('contentType', contentType);
    if (ext) qs.set('ext', ext);

    return this.api.get<PresignedUrlResponse>(
      `/file/upload-presigned-url/${fileId}?${qs.toString()}`,
    );
  }

  /**
   * Upload bytes directly to S3 using the presigned URL.
   * This does NOT send auth headers (and must not).
   */
  uploadToS3(presignedUrl: string, file: File): Observable<Response> {
    return from(
      fetch(presignedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      }),
    );
  }

  /**
   * Tell backend to verify the object exists (HEAD) and update DB.
   */
  confirmUpload(fileId: string): Observable<any> {
    return this.api.post(`/file/confirm-upload/${fileId}`, {});
  }

  /**
   * Optional: get download URL when you need to download/open the file.
   */
  getDownloadPresignedUrl(
    fileId: string,
    downloadName?: string,
  ): Observable<PresignedUrlResponse> {
    const qs = new URLSearchParams();
    if (downloadName) qs.set('downloadName', downloadName);

    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.api.get<PresignedUrlResponse>(
      `/file/download-presigned-url/${fileId}${suffix}`,
    );
  }
}
