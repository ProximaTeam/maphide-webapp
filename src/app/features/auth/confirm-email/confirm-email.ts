import {
    Component,
    ChangeDetectionStrategy,
    inject,
    signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../../core/user/user';
import { CommonModule } from '@angular/common';
import { UserStore } from 'src/app/core/auth/user.store';

@Component({
    selector: 'app-confirm-email',
    standalone: true,
    imports: [FormsModule, CommonModule],
    templateUrl: './confirm-email.html',
    styleUrl: './confirm-email.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmEmailComponent {
    private userService = inject(UserService);
    private router = inject(Router);
    private userStore = inject(UserStore);

    code = '';
    loading = signal(false);
    error = signal<string | null>(null);
    success = signal(false);

    submit() {
        if (!this.code.trim()) {
            this.error.set('Please enter the confirmation code');
            return;
        }

        this.loading.set(true);
        this.error.set(null);

        const numericCode = Number(this.code.trim());

        if (isNaN(numericCode)) {
            this.error.set("Code must be a number.");
            return;
        }

        this.userService.confirmEmail(numericCode).subscribe({
            next: () => {
                this.loading.set(false);
                this.success.set(true);
                this.userStore.markEmailConfirmed();
                setTimeout(() => {
                    this.router.navigateByUrl('/');
                }, 1500);
            },
            error: (err) => {
                console.error(err);
                this.loading.set(false);
                this.error.set('Invalid or expired confirmation code.');
            }
        });
    }
}
