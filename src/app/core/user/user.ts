import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api/api';

@Injectable({ providedIn: 'root' })
export class UserService {
  private api = inject(ApiService);

  confirmEmail(code: number) {
    return this.api.put('/user/confirm-email', { code });
  }

  changePassword(oldPassword: string, newPassword: string) {
    return this.api.put('/user/change-password', {
      oldPassword,
      newPassword,
    });
  }
}
