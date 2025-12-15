import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserStore } from '../user.store';

export const emailConfirmGuard: CanActivateFn = () => {
  const userStore = inject(UserStore);
  const router = inject(Router);

  if (userStore.isAwaitingEmailConfirmation()) {
    router.navigateByUrl('/auth/confirm-email');
    return false;
  }
  return true;
};
