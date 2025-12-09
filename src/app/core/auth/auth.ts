import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../api/api';
import { tap } from 'rxjs';

export interface User {
  id: string;
  username: string;
  email?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);

  readonly user = signal<User | null>(null);
  private accessToken: string | null = null;

  login(username: string, password: string) {
    return this.api
      .post<{ user: User; token?: string }>('/login', {
        email: username,
        password
      })
      .pipe(
        tap((res) => {
          this.user.set(res.user);
          this.accessToken = res.token ?? null;
          if (res.token) {
            localStorage.setItem("accessToken", res.token);
          }
        })
      );
  }

  register(email: string, password: string) {
    return this.api
      .post<{ user: User; token?: string }>('/register', {
        email,
        password
      })
      .pipe(
        tap((res) => {
          this.user.set(res.user);
          this.accessToken = res.token ?? null;
          if (res.token) {
            localStorage.setItem("accessToken", res.token);
          }
        })
      );
  }

  getAccessTokenSync(): string | null {
    return this.accessToken ?? localStorage.getItem('accessToken');
  }

  logout(callBackend = true) {
    if (callBackend) {
      this.api.post('/auth/logout', {}).subscribe({
        error: () => { }
      });
    }
    this.user.set(null);
    this.accessToken = null;
    localStorage.removeItem("accessToken");
  }
}
