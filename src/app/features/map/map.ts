// src/app/features/map/map.ts
/* global google */
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  ViewChild
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DropService } from '../../core/drop/drop';
import { CommonModule, DecimalPipe } from '@angular/common';
import { CryptoService } from '../../core/crypto/crypto';
import { DropCreate } from './drop-create/drop-create';
import { DropView } from './drop-view/drop-view';
import { MapDropHandler } from 'src/app/core/map/map-drop';
import {
  GRID_DEG_LAT,
  GRID_DEG_LNG,
  getCellCoords,
  getCellBounds,
  CellCoords
} from '../../core/map/map-grid';
import { MapEvents } from 'src/app/core/map/map-events';
import { MapRenderer } from 'src/app/core/map/map-renderer';


declare const google: any;

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, DecimalPipe, DropCreate, DropView],
  templateUrl: './map.html',
  styleUrl: './map.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Map implements AfterViewInit {
  @ViewChild('mapContainer', { static: true })
  mapContainer!: ElementRef<HTMLDivElement>;

  @ViewChild('gridCanvas', { static: true })
  gridCanvas!: ElementRef<HTMLCanvasElement>;

  @ViewChild('hoverCanvas', { static: true })
  hoverCanvas!: ElementRef<HTMLCanvasElement>;

  private map!: google.maps.Map;
  private dropHandler!: MapDropHandler;
  private mapEvents!: MapEvents;
  private renderer!: MapRenderer;
  private gridCtx!: CanvasRenderingContext2D;
  private hoverCtx!: CanvasRenderingContext2D;

  private readonly MIN_ZOOM_FOR_GRID = 19;

  private gridVisible = false;
  private hoveredCell: CellCoords | null = null;

  isSatellite = false;

  // CREATE DROP MODAL
  dropModalOpen = false;
  dropLat: number | null = null;
  dropLng: number | null = null;
  dropMessage = '';
  dropPasswordLock = false;
  dropPassword = '';
  dropHidden = false;
  dropSaving = false;
  dropError: string | null = null;

  // EXISTING DROP MODAL
  existingModalOpen = false;
  existingDrops: any[] = [];
  unlockPassword = '';
  decrypting = false;
  decryptError: string | null = null;

  constructor(
    private dropService: DropService,
    private crypto: CryptoService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    this.dropHandler = new MapDropHandler(dropService, crypto);
  }

  ngAfterViewInit(): void {
    this.initMap();
    this.initCanvases();
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
  }

  // ---------------------------------------------------------------------------
  // MAP SETUP
  // ---------------------------------------------------------------------------

  private initMap() {
    if (!(window as any).google?.maps) {
      console.error('Google Maps JavaScript API not loaded');
      return;
    }

    this.map = new google.maps.Map(this.mapContainer.nativeElement, {
      center: { lat: 40.7128, lng: -74.006 },
      zoom: 18,
      minZoom: 2,
      maxZoom: 21,
      disableDefaultUI: true,
      gestureHandling: 'greedy',
      mapTypeId: google.maps.MapTypeId.ROADMAP
    });

    this.map.addListener('idle', () => {
      this.renderer.drawGrid(this.map, this.gridCanvas.nativeElement);
    });

    this.mapEvents = new MapEvents(
      this.map,

      // CLICK
      (coords, lat, lng) => {
        this.ngZone.run(() => {
          this.lookupDrop(lat, lng);
        });
      },

      // HOVER
      (coords) => {
        this.hoveredCell = coords;
        this.renderer.drawHoverCell(this.map, coords!, this.hoverCanvas.nativeElement);
      }
    );
    this.mapEvents.bind();

    // OPTIONAL auto center geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.map.setCenter({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
          this.map.setZoom(this.MIN_ZOOM_FOR_GRID);
        },
        () => { }
      );
    }

    google.maps.event.addListenerOnce(this.map, 'tilesloaded', () => {
      this.renderer.drawGrid(this.map, this.gridCanvas.nativeElement);
    });
  }

  toggleSatellite() {
    this.isSatellite = !this.isSatellite;
    this.map.setMapTypeId(
      this.isSatellite
        ? google.maps.MapTypeId.SATELLITE
        : google.maps.MapTypeId.ROADMAP
    );
  }

  private initCanvases() {
    this.gridCtx = this.gridCanvas.nativeElement.getContext('2d')!;
    this.hoverCtx = this.hoverCanvas.nativeElement.getContext('2d')!;
    this.renderer = new MapRenderer(this.gridCtx, this.hoverCtx);
  }

  private handleResize() {
    const el = this.mapContainer.nativeElement;
    this.gridCanvas.nativeElement.width = el.clientWidth;
    this.gridCanvas.nativeElement.height = el.clientHeight;
    this.hoverCanvas.nativeElement.width = el.clientWidth;
    this.hoverCanvas.nativeElement.height = el.clientHeight;
    this.renderer.drawGrid(this.map, this.gridCanvas.nativeElement);
  }

  // ---------------------------------------------------------------------------
  // CREATE DROP
  // ---------------------------------------------------------------------------

  openDropModal(lat: number, lng: number) {
    this.dropLat = lat;
    this.dropLng = lng;
    this.dropMessage = '';
    this.dropPasswordLock = false;
    this.dropPassword = '';
    this.dropHidden = false;
    this.dropError = null;
    this.dropModalOpen = true;
    this.cdr.markForCheck();
  }

  closeDropModal() {
    this.dropModalOpen = false;
    this.cdr.markForCheck();
  }

  saveDrop() {
    if (!this.dropLat || !this.dropLng) return;

    if (!this.dropMessage.trim()) {
      this.dropError = 'Please enter a message';
      this.cdr.markForCheck();
      return;
    }

    if (this.dropPasswordLock && !this.dropPassword) {
      this.dropError = 'Password required';
      this.cdr.markForCheck();
      return;
    }

    this.dropSaving = true;
    this.dropError = null;
    this.cdr.markForCheck();

    this.dropService.createDrop({
      lat: this.dropLat,
      lng: this.dropLng,
      message: this.dropMessage.trim(),
      passwordLock: this.dropPasswordLock,
      password: this.dropPassword,
      hidden: this.dropHidden
    })
      .subscribe({
        next: () => {
          this.dropSaving = false;
          this.dropModalOpen = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error(err);
          this.dropSaving = false;
          this.dropError = 'Failed to save drop';
          this.cdr.markForCheck();
        }
      });
  }

  // ---------------------------------------------------------------------------
  // RETRIEVE / DECRYPT
  // ---------------------------------------------------------------------------

  lookupDrop(lat: number, lng: number) {
    this.dropHandler.findDrop(lat, lng).subscribe({
      next: (drops: any[]) => {
        if (!drops || drops.length === 0) {
          this.openDropModal(lat, lng);
        } else {
          this.existingDrops = drops.map(d => ({
            ...d,
            unlocked: false,
            decrypted: null
          }));
          this.existingModalOpen = true;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.openDropModal(lat, lng);
        this.cdr.markForCheck();
      }
    });
  }


  async decryptDrop(drop: any) {
    this.decrypting = true;
    this.decryptError = null;
    this.cdr.markForCheck();

    try {
      const plaintext = await this.crypto.decrypt(
        {
          ciphertext: drop.ciphertext,
          nonce: drop.nonce,
          salt: drop.salt,
          kdfParams: drop.kdfParams
        },
        this.unlockPassword
      );

      drop.unlocked = true;
      drop.decrypted = plaintext;
      this.unlockPassword = '';

    } catch (err) {
      console.error(err);
      this.decryptError = 'Incorrect password';
    }

    this.decrypting = false;
    this.cdr.markForCheck();
  }

  closeExistingModal() {
    this.existingModalOpen = false;
    this.existingDrops = [];
    this.unlockPassword = '';
    this.decryptError = null;
    this.cdr.markForCheck();
  }

  onCreateDrop(ev: {
    message: string;
    passwordLock: boolean;
    password?: string;
    hidden: boolean;
  }) {
    if (!this.dropLat || !this.dropLng) return;

    this.dropSaving = true;
    this.dropError = null;
    this.cdr.markForCheck();

    this.dropHandler.createDrop({
      lat: this.dropLat,
      lng: this.dropLng,
      message: ev.message,
      passwordLock: ev.passwordLock,
      password: ev.password,
      hidden: ev.hidden
    })
      .subscribe({
        next: () => {
          this.dropSaving = false;
          this.dropModalOpen = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.dropSaving = false;
          this.dropError = 'Failed to save drop';
          this.cdr.markForCheck();
        }
      });
  }


  onDecryptDrop(ev: { drop: any; password: string }) {
    this.decrypting = true;
    this.decryptError = null;
    this.cdr.markForCheck();

    this.dropHandler.decrypt(ev.drop, ev.password)
      .then(plaintext => {
        ev.drop.unlocked = true;
        ev.drop.decrypted = plaintext;
        this.decrypting = false;
        this.cdr.markForCheck();
      })
      .catch(() => {
        this.decryptError = 'Incorrect password';
        this.decrypting = false;
        this.cdr.markForCheck();
      });
  }
}
