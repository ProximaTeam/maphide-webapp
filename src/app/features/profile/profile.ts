import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserStore } from 'src/app/core/auth/user.store';
import { UserService } from 'src/app/core/user/user';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Profile {
  userStore = inject(UserStore);
  private userService = inject(UserService);

  oldPassword = '';
  newPassword = '';
  confirmPassword = '';

  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  submit() {
    this.error.set(null);
    this.success.set(null);

    if (!this.oldPassword || !this.newPassword || !this.confirmPassword) {
      this.error.set('Please fill in all fields.');
      return;
    }

    if (this.newPassword.length < 8) {
      this.error.set('New password must be at least 8 characters.');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.error.set('New password and confirmation do not match.');
      return;
    }

    this.loading.set(true);

    this.userService.changePassword(this.oldPassword, this.newPassword).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set('Password updated.');
        this.oldPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
      },
      error: (err) => {
        console.error(err);
        this.loading.set(false);
        this.error.set('Failed to change password. Check your current password and try again.');
      }
    });
  }
}
