import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type DropAction =
  | { type: 'pw'; drop: any; password: string }
  | { type: 'otc-generate'; drop: any }
  | { type: 'otc-verify'; drop: any; code: number | string }
  | { type: 'gps'; drop: any }
  | { type: 'decrypt'; drop: any; password: string };

@Component({
  selector: 'mh-drop-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './drop-view.html',
  styleUrls: ['./drop-view.scss'],
})
export class DropView {
  @Input() drops: any[] = [];
  @Input() decrypting = false; // only for final decrypt
  @Input() error: string | null = null;

  @Output() close = new EventEmitter<void>();

  // ✅ single action output (step-by-step)
  @Output() action = new EventEmitter<DropAction>();

  // keep these outputs (your map already uses them)
  @Output() download = new EventEmitter<any>();
  @Output() delete = new EventEmitter<any>();

  password = signal('');
  otc = signal('');

  verifyPassword(drop: any) {
    this.action.emit({
      type: 'pw',
      drop,
      password: this.password(),
    });
  }

  generateOtc(drop: any) {
    this.action.emit({
      type: 'otc-generate',
      drop,
    });
  }

  verifyOtc(drop: any) {
    this.action.emit({
      type: 'otc-verify',
      drop,
      code: this.otc(),
    });
  }

  verifyGps(drop: any) {
    this.action.emit({
      type: 'gps',
      drop,
    });
  }

  decryptNow(drop: any) {
    this.action.emit({
      type: 'decrypt',
      drop,
      password: this.password(),
    });
  }

  downloadFile(drop: any) {
    this.download.emit(drop);
  }

  deleteDrop(drop: any) {
    this.delete.emit(drop);
  }
}
