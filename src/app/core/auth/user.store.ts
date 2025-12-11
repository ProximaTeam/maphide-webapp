// src/app/core/auth/user.store.ts
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth';
import { tap } from 'rxjs';

export interface User {
  id: string;
  username: string;
  email?: string;
}

@Injectable({ providedIn: 'root' })
export class UserStore {
  private auth = inject(AuthService);

  private _user = signal<User | null>(null);
  readonly user = computed(() => this._user());
  readonly isLoggedIn = computed(() => this._user() !== null);

  private _token = signal<string | null>(localStorage.getItem('accessToken'));

  constructor() {
    // restore session if token exists
    effect(() => {
      const token = this._token();
      if (token && !this._user()) {
        this.auth.getProfile().subscribe({
          next: (user) => this._user.set(user),
          error: () => this.logout(false)
        });
      }
    });
  }

  login(email: string, password: string) {
    return this.auth.login(email, password).pipe(
      tap(res => {
        this._user.set(res.user);
        this._token.set(res.token ?? null);

        if (res.token) localStorage.setItem('accessToken', res.token);
      })
    );
  }

  logout(callBackend = true) {
    if (callBackend) this.auth.logout();

    this._user.set(null);
    this._token.set(null);

    localStorage.removeItem('accessToken');
  }

  get token(): string | null {
    return this._token();
  }
}
