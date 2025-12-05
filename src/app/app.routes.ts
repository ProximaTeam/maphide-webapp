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
    path: '**',
    redirectTo: ''
  }
];
