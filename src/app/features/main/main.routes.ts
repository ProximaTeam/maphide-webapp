import { Routes } from '@angular/router';
import { Main } from './main';

export const MAIN_ROUTES: Routes = [
  {
    path: '',
    component: Main,
    children: [
      {
        path: '',
        loadComponent: () => import('../map/map').then((m) => m.Map),
        pathMatch: 'full'
      }
    ]
  }
];
