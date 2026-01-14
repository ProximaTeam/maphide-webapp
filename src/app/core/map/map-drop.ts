import { DropService } from '../../core/drop/drop';
import { CryptoService } from '../../core/crypto/crypto';
import { FileService } from '../file/file';
import { map, switchMap } from 'rxjs/operators';
import { of, throwError } from 'rxjs';

export class MapDropHandler {
  constructor(
    private dropService: DropService,
    private crypto: CryptoService,
    private fileService: FileService,
  ) { }

  findDrop(lat: number, lng: number) {
    return this.dropService.getDropAt(lat, lng);  // unify naming
  }

  createDrop(data: {
    lat: number;
    lng: number;
    message: string;
    passwordLock: boolean;
    password?: string;
    hidden: boolean;
    otcLock: boolean;
    gpsLock: boolean;
    file?: File;
  }) {
    return this.dropService.createDrop(data).pipe(
      switchMap((resp: any) => {
        const file = data.file;
        const fileId = resp?.fileId as string | undefined;

        // No file attached → done
        if (!file || !fileId) return of(resp);

        const contentType = file.type || 'application/octet-stream';
        const ext = this.getExt(file.name); // ".pdf" etc

        // presign → PUT to S3 → confirm
        return this.fileService.getUploadPresignedUrl(fileId, contentType, ext).pipe(
          switchMap((p) => this.fileService.uploadToS3(p.url, file)),
          switchMap((putResp) => {
            if (!putResp.ok) {
              return throwError(() => new Error(`S3 upload failed (${putResp.status})`));
            }
            return this.fileService.confirmUpload(fileId);
          }),
          // return original create response (or you could return confirm response)
          map(() => resp),
        );
      }),
    );
  }

  private getExt(name: string): string | undefined {
    const idx = name.lastIndexOf('.');
    if (idx <= 0 || idx === name.length - 1) return undefined;
    return name.slice(idx); // includes dot, e.g. ".pdf"
  }

  async decrypt(drop: any, password: string | null) {
    return await this.crypto.decrypt(
      {
        ciphertext: drop.ciphertext,
        nonce: drop.nonce,
        salt: drop.salt,
        kdfParams: drop.kdfParams
      },
      password ?? ''
    );
  }

  getVisibleDrops() {
    return this.dropService.getVisibleDrops();
  }
}
