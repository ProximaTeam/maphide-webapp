import { DropService } from '../../core/drop/drop';
import { CryptoService } from '../../core/crypto/crypto';

export class MapDropHandler {
  constructor(
    private dropService: DropService,
    private crypto: CryptoService
  ) {}

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
  }) {
    return this.dropService.createDrop(data);
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
}
