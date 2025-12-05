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
import { DropService } from '../../core/services/drop';
import { CommonModule, DecimalPipe } from '@angular/common';
import { CryptoService } from '../../core/services/crypto';

interface CellCoords {
  x: number;
  y: number;
}

declare const google: any;

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, DecimalPipe],
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
  private gridCtx!: CanvasRenderingContext2D;
  private hoverCtx!: CanvasRenderingContext2D;

  private readonly MIN_ZOOM_FOR_GRID = 19;
  private readonly GRID_DEG_LAT = 0.000045;
  private readonly GRID_DEG_LNG = 0.000055;

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
  ) {}

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

    this.map.addListener('idle', () => this.drawGrid());

    this.map.addListener('mousemove', (e: google.maps.MapMouseEvent) => {
      if (!this.gridVisible || !e.latLng) {
        this.hoveredCell = null;
        this.clearHover();
        return;
      }

      const newCell = this.getCellCoords(e.latLng.lat(), e.latLng.lng());
      if (!this.hoveredCell || newCell.x !== this.hoveredCell.x || newCell.y !== this.hoveredCell.y) {
        this.hoveredCell = newCell;
        this.drawHoverCell();
      }
    });

    // CLICK LOOKUP
    this.map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!this.gridVisible || !e.latLng) return;

      this.ngZone.run(() => {
        const lat = e.latLng!.lat();
        const lng = e.latLng!.lng();
        this.lookupDrop(lat, lng);
      });
    });

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
        () => {}
      );
    }
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
  }

  private handleResize() {
    const el = this.mapContainer.nativeElement;
    this.gridCanvas.nativeElement.width = el.clientWidth;
    this.gridCanvas.nativeElement.height = el.clientHeight;
    this.hoverCanvas.nativeElement.width = el.clientWidth;
    this.hoverCanvas.nativeElement.height = el.clientHeight;
    this.drawGrid();
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
    this.dropService.getDropAt(lat, lng).subscribe({
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
      error: (err) => {
        console.error('Drop lookup failed:', err);
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

  // ---------------------------------------------------------------------------
  // GRID MATH & DRAWING (unchanged)
  // ---------------------------------------------------------------------------

  private getCellCoords(lat: number, lng: number): CellCoords {
    return {
      x: Math.floor(lng / this.GRID_DEG_LNG),
      y: Math.floor(lat / this.GRID_DEG_LAT)
    };
  }

  private getCellBoundsFromCoords(x: number, y: number) {
    return {
      south: y * this.GRID_DEG_LAT,
      north: (y + 1) * this.GRID_DEG_LAT,
      west: x * this.GRID_DEG_LNG,
      east: (x + 1) * this.GRID_DEG_LNG
    };
  }

  private latLngToPixel(
    lat: number,
    lng: number,
    projection: google.maps.Projection,
    centerWorld: google.maps.Point,
    scale: number,
    cw: number,
    ch: number
  ) {
    const world = projection.fromLatLngToPoint(new google.maps.LatLng(lat, lng));
    if (!world) return { x: -9999, y: -9999 };

    return {
      x: (world.x - centerWorld.x) * scale + cw / 2,
      y: (world.y - centerWorld.y) * scale + ch / 2
    };
  }

  private drawGrid() {
    const canvas = this.gridCanvas.nativeElement;
    const ctx = this.gridCtx;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!this.map) return;

    const zoom = this.map.getZoom() ?? 0;
    this.gridVisible = zoom >= this.MIN_ZOOM_FOR_GRID;
    if (!this.gridVisible) {
      this.clearHover();
      return;
    }

    const bounds = this.map.getBounds();
    const projection = this.map.getProjection();
    const center = this.map.getCenter();
    if (!bounds || !projection || !center) return;

    const centerWorld = projection.fromLatLngToPoint(center);
    if (!centerWorld) return;

    const scale = Math.pow(2, zoom);

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const north = ne.lat();
    const east = ne.lng();
    const south = sw.lat();
    const west = sw.lng();

    const startX = Math.floor(west / this.GRID_DEG_LNG) - 1;
    const endX = Math.ceil(east / this.GRID_DEG_LNG) + 1;
    const startY = Math.floor(south / this.GRID_DEG_LAT) - 1;
    const endY = Math.ceil(north / this.GRID_DEG_LAT) + 1;

    ctx.strokeStyle = 'rgba(14, 165, 233, 0.75)';
    ctx.lineWidth = 1;

    // verticals
    for (let x = startX; x <= endX; x++) {
      const lng = x * this.GRID_DEG_LNG;

      const a = this.latLngToPixel(north, lng, projection, centerWorld, scale, canvas.width, canvas.height);
      const b = this.latLngToPixel(south, lng, projection, centerWorld, scale, canvas.width, canvas.height);

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // horizontals
    for (let y = startY; y <= endY; y++) {
      const lat = y * this.GRID_DEG_LAT;

      const a = this.latLngToPixel(lat, west, projection, centerWorld, scale, canvas.width, canvas.height);
      const b = this.latLngToPixel(lat, east, projection, centerWorld, scale, canvas.width, canvas.height);

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    this.drawHoverCell();
  }

  private clearHover() {
    const canvas = this.hoverCanvas.nativeElement;
    this.hoverCtx.clearRect(0, 0, canvas.width, canvas.height);
  }

  private drawHoverCell() {
    const canvas = this.hoverCanvas.nativeElement;
    const ctx = this.hoverCtx;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!this.gridVisible || !this.hoveredCell || !this.map) return;

    const projection = this.map.getProjection();
    const center = this.map.getCenter();
    if (!projection || !center) return;

    const centerWorld = projection.fromLatLngToPoint(center);
    if (!centerWorld) return;

    const scale = Math.pow(2, this.map.getZoom()!);

    const bounds = this.getCellBoundsFromCoords(this.hoveredCell.x, this.hoveredCell.y);
    const nw = this.latLngToPixel(bounds.north, bounds.west, projection, centerWorld, scale, canvas.width, canvas.height);
    const se = this.latLngToPixel(bounds.south, bounds.east, projection, centerWorld, scale, canvas.width, canvas.height);

    const w = se.x - nw.x;
    const h = se.y - nw.y;

    ctx.fillStyle = 'rgba(14, 165, 233, 0.25)';
    ctx.fillRect(nw.x, nw.y, w, h);

    ctx.strokeStyle = 'rgba(14, 165, 233, 1)';
    ctx.lineWidth = 2;
    ctx.strokeRect(nw.x, nw.y, w, h);
  }
}
