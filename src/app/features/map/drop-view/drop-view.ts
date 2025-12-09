import { Component, Input, Output, EventEmitter, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'mh-drop-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './drop-view.html',
  styleUrls: ['./drop-view.scss'],
  encapsulation: ViewEncapsulation.None
})
export class DropView {

  @Input() drops: any[] = [];
  @Input() decrypting = false;
  @Input() error: string | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() decrypt = new EventEmitter<{ drop: any; password: string }>();

  password = signal('');

  submitDecrypt(drop: any) {
    this.decrypt.emit({ drop, password: this.password() });
  }
}
