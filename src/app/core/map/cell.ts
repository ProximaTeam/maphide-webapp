import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api/api';
import { Observable } from 'rxjs';

export interface CellCoords {
  x: number;
  y: number;
}

export interface CellNote {
  id: string;
  cellX: number;
  cellY: number;
  type: 'public' | 'protected';
  content?: string;
  ciphertext?: string;
  iv?: string;
  salt?: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class CellService {
  private api = inject(ApiService);

  getCellNotes(x: number, y: number): Observable<CellNote[]> {
    return this.api.get<CellNote[]>(`/cells/${x}/${y}`);
  }

  createNote(coords: CellCoords, payload: Partial<CellNote>): Observable<CellNote> {
    return this.api.post<CellNote>(
      `/cells/${coords.x}/${coords.y}/notes`,
      payload
    );
  }
}
