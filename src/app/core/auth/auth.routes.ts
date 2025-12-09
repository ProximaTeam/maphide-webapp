import { Routes } from '@angular/router';
import { AuthShell } from '../../features/auth/auth';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    component: AuthShell,
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('../../features/auth/login/login').then((m) => m.Login)
      },
      {
        path: 'register',
        loadComponent: () =>
          import('../../features/auth/register/register').then((m) => m.Register)
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'login'
      }
    ]
  }
];
