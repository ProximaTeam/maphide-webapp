import { Component, Input, Output, EventEmitter, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'mh-drop-create',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './drop-create.html',
    styleUrls: ['./drop-create.scss'],
    encapsulation: ViewEncapsulation.None
})
export class DropCreate {

    @Input() lat!: number;
    @Input() lng!: number;

    @Input() saving = false;
    @Input() error: string | null = null;

    @Input() requireAuth = false;

    @Output() login = new EventEmitter<void>();
    @Output() register = new EventEmitter<void>();


    @Output() save = new EventEmitter<{
        message: string;
        passwordLock: boolean;
        password?: string;
        otcLock: boolean;
        gpsLock: boolean;
        hidden: boolean;
        file?: File;
    }>();

    @Output() close = new EventEmitter<void>();

    message = signal('');
    passwordLock = signal(false);
    otcLock = signal(false);
    gpsLock = signal(false);
    password = signal('');
    hidden = signal(false);
    selectedFile = signal<File | null>(null);
    selectedFileName = signal('');
    selectedFileSize = signal(0);

    submit() {
        if (this.requireAuth) return;
        if (!this.message().trim()) return;

        this.save.emit({
            message: this.message().trim(),
            passwordLock: this.passwordLock(),
            password: this.passwordLock() ? this.password() : undefined,
            hidden: this.hidden(),
            otcLock: this.otcLock(),
            gpsLock: this.gpsLock(),
            file: this.selectedFile() ?? undefined,
        });
    }


    onFileSelected(evt: Event) {
        const input = evt.target as HTMLInputElement;
        const file = input.files?.[0] ?? null;

        this.selectedFile.set(file);
        this.selectedFileName.set(file?.name ?? '');
        this.selectedFileSize.set(file?.size ?? 0);
    }
}
