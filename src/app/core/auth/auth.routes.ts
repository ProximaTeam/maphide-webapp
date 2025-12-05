import { Routes } from '@angular/router';
import { AuthShell } from './auth';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    component: AuthShell,
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./login/login').then((m) => m.Login)
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./register/register').then((m) => m.Register)
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'login'
      }
    ]
  }
];
