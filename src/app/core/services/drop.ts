// src/app/core/services/drop.ts
import { Injectable, inject } from '@angular/core';
import { ApiService } from './api';
import { CryptoService, EncryptedPayload } from './crypto';
import { from, map, mergeMap, Observable } from 'rxjs';

export interface VNewDrop {
    ciphertext: string;
    nonce: string;
    salt: string;
    kdfParams: {
        iterations: number;
        hash: string;
    };
    fileName: string;
    fileSize: number;
    lat: number;
    lng: number;
    passwordLock: boolean;
    password?: string;
    otcLock: boolean;
    gpsLock: boolean;
    hidden: boolean;
    premiumUser: boolean;
}

@Injectable({ providedIn: 'root' })
export class DropService {
    private api = inject(ApiService);
    private crypto = inject(CryptoService);

    /**
     * Create a new drop at lat/lng with optional password + hidden flag.
     */
    createDrop(params: {
        lat: number;
        lng: number;
        message: string;
        passwordLock: boolean;
        password?: string;
        hidden: boolean;
    }): Observable<any> {
        const effectivePassword =
            params.passwordLock ? (params.password || '') : '';

        // Encrypt message → produces ciphertext, nonce, salt, kdfParams
        const encrypt$ = from(this.crypto.encrypt(params.message, effectivePassword));

        return encrypt$.pipe(
            map<EncryptedPayload, VNewDrop>((enc) => {
                return {
                    ciphertext: enc.ciphertext,
                    nonce: enc.nonce,
                    salt: enc.salt,
                    kdfParams: enc.kdfParams,
                    fileName: '',
                    fileSize: 0,
                    lat: params.lat,
                    lng: params.lng,
                    passwordLock: params.passwordLock,
                    password: params.passwordLock ? params.password : undefined,
                    otcLock: false,
                    gpsLock: false,
                    hidden: params.hidden,
                    premiumUser: false
                };
            }),
            mergeMap((payload) => this.api.post('/drop/create', payload))
        );
    }

    /**
     * Retrieve drops stored at an exact lat/lng.
     * Backend returns an array (0, 1, or many).
     */
    getDropAt(lat: number, lng: number): Observable<any[]> {
        return this.api.get<any[]>(`/drop/at?lat=${lat}&lng=${lng}`);
    }


    /**
     * Optional: Retrieve encrypted content for a specific drop by id.
     * (Some projects store only metadata in `/drop/at`, but yours returns ciphertext already.)
     */
    getEncryptedContent(id: string) {
        return this.api.get(`/drop/content/${id}`);
    }

    /**
     * Convenience wrapper around CryptoService.decrypt.
     */
    decryptLocal(payload: {
        ciphertext: string;
        nonce: string;
        salt: string;
        kdfParams: any;
    }, password: string): Promise<string> {
        return this.crypto.decrypt(payload, password);
    }
}
