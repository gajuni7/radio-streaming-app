import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./explore-container/explore-container.component').then((m) => m.ExploreContainerComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
