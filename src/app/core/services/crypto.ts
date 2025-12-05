import { Injectable } from '@angular/core';

export interface KdfParams {
  iterations: number;
  hash: string;
}

export interface EncryptedPayload {
  ciphertext: string;
  nonce: string;
  salt: string;
  kdfParams: KdfParams;
}

@Injectable({ providedIn: 'root' })
export class CryptoService {

  private readonly iterations = 150000;   // adjust if needed
  private readonly hash = 'SHA-256';

  private enc = new TextEncoder();
  private dec = new TextDecoder();

  async encrypt(content: string, password: string): Promise<EncryptedPayload> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const nonce = crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      this.enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: this.iterations,
        hash: this.hash
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      key,
      this.enc.encode(content)
    );

    return {
      ciphertext: this.toB64(new Uint8Array(ciphertext)),
      nonce: this.toB64(nonce),
      salt: this.toB64(salt),
      kdfParams: {
        iterations: this.iterations,
        hash: this.hash
      }
    };
  }

  async decrypt(payload: EncryptedPayload, password: string): Promise<string> {
    const salt = this.fromB64(payload.salt);
    const nonce = this.fromB64(payload.nonce);
    const ciphertext = this.fromB64(payload.ciphertext);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      this.enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: payload.kdfParams.iterations,
        hash: payload.kdfParams.hash
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce },
      key,
      ciphertext
    );

    return this.dec.decode(plainBuffer);
  }

  private toB64(bytes: Uint8Array): string {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  private fromB64(b64: string): Uint8Array {
    const raw = atob(b64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
}
