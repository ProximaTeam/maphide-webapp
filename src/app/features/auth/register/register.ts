import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { UserStore } from 'src/app/core/auth/user.store';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './register.html',
  styleUrl: './register.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Register {
  private userStore = inject(UserStore);
  private router = inject(Router);

  email = '';
  password = '';
  confirmPassword = '';
  loading = signal(false);
  error = signal<string | null>(null);

  submit() {
    if (!this.email || !this.password || !this.confirmPassword) {
      this.error.set('Please fill in all fields');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error.set('Passwords do not match');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.userStore.register(this.email, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigateByUrl('/auth/confirm-email');
      },
      error: (err) => {
        console.error(err);
        this.loading.set(false);
        this.error.set('Registration failed');
      }
    });
  }
}
