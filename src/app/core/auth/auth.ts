import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api/api';
import type { User } from './user.store';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);

  /**
   * Performs login but does NOT store user/token.
   * The UserStore handles that.
   */
  login(email: string, password: string) {
    return this.api.post<{ user: User; token?: string }>('/login', {
      email,
      password
    });
  }

  /**
   * Same for register
   */
  register(email: string, password: string) {
    return this.api.post<{ user: User; token?: string }>('/register', {
      email,
      password
    });
  }

  /**
   * /auth/me for restoring session
   */
  getProfile() {
    return this.api.get<User>('/user/me');
  }

  /**
   * Logout request only — 
   * UserStore wipes state.
   */
  logout() {
    return this.api.post('/auth/logout', {});
  }
}
