import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./features/main/main.routes').then((m) => m.MAIN_ROUTES)
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('./core/auth/auth.routes').then((m) => m.AUTH_ROUTES)
  },

  {
    path: 'auth/confirm-email',
    loadComponent: () =>
      import('./features/auth/confirm-email/confirm-email')
        .then(m => m.ConfirmEmailComponent)
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./features/profile/profile')
        .then(m => m.Profile)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
