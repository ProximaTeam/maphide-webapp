import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'mh-drop-view',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './drop-view.html',
    styleUrls: ['./drop-view.scss']
})
export class DropView {
    @Input() drops: any[] = [];
    @Input() decrypting = false;          // used ONLY for final unlock
    @Input() error: string | null = null;

    @Output() close = new EventEmitter<void>();
    @Output() decrypt = new EventEmitter<any>();
    @Output() generateOtcEvent = new EventEmitter<any>();
    @Output() verifyOtcEvent = new EventEmitter<any>();

    password = signal('');
    otc = signal('');

    // local states
    otcGenerating = signal(false);
    otcVerifying = signal(false);

    submitDecrypt(drop: any) {
        this.decrypt.emit({
            drop,
            password: this.password(),
            requireGps: false
        });
    }

    // GENERATE OTC
    generateOtc(drop: any) {
        this.decrypt.emit({
            drop,
            generateOtc: true,
            requireGps: false
        });
    }

    // SUBMIT OTC
    submitOtc(drop: any) {
        this.decrypt.emit({
            drop,
            otc: this.otc()!,
            requireGps: false
        });
    }
}

