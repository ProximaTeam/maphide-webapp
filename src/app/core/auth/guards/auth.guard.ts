// src/app/core/auth/auth.guard.ts
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { UserStore } from '../user.store';

export const authGuard = () => {
  const userStore = inject(UserStore);
  const router = inject(Router);

  if (userStore.isLoggedIn()) {
    return true;
  }

  return router.createUrlTree(['/auth/login']);
};
