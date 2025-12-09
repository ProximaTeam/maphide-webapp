import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-shell',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './auth.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthShell {}
