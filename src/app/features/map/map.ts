// src/app/features/map/map.ts
/* global google */
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  ViewChild,
  inject,
  effect,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, DecimalPipe } from '@angular/common';

import { DropService } from '../../core/drop/drop';
import { CryptoService } from '../../core/crypto/crypto';
import { DropCreate } from './drop-create/drop-create';
import { DropView } from './drop-view/drop-view';

import { MapDropHandler } from 'src/app/core/map/map-drop';
import { getCellCoords, getCellBounds, CellCoords } from '../../core/map/map-grid';
import { MapEvents } from 'src/app/core/map/map-events';
import { MapRenderer } from 'src/app/core/map/map-renderer';
import { UserStore } from 'src/app/core/auth/user.store';
import { FileService } from 'src/app/core/file/file';

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
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('gridCanvas', { static: true }) gridCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('markersCanvas', { static: true }) markersCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('hoverCanvas', { static: true }) hoverCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('eventLayer', { static: true }) eventLayer!: ElementRef<HTMLDivElement>;

  userStore = inject(UserStore);

  private map!: google.maps.Map;
  private overlay!: google.maps.OverlayView;

  private dropHandler!: MapDropHandler;
  private mapEvents!: MapEvents;

  private renderer!: MapRenderer;
  private gridCtx!: CanvasRenderingContext2D;
  private hoverCtx!: CanvasRenderingContext2D;

  private markersCtx!: CanvasRenderingContext2D;

  private readonly MIN_ZOOM_FOR_GRID = 19;

  private hoveredCell: CellCoords | null = null;

  private lockHeadingListener?: google.maps.MapsEventListener;
  private lockTiltListener?: google.maps.MapsEventListener;

  visibleDrops: any[] = [];

  isSatellite = false;

  // CREATE DROP MODAL
  dropModalOpen = false;
  dropLat: number | null = null;
  dropLng: number | null = null;
  dropSaving = false;
  dropError: string | null = null;

  // EXISTING DROP MODAL
  existingModalOpen = false;
  existingDrops: any[] = [];
  decrypting = false;
  decryptError: string | null = null;

  isLoggedIn = this.userStore.isLoggedIn;
  user = this.userStore.user;

  constructor(
    private dropService: DropService,
    private crypto: CryptoService,
    private fileService: FileService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private router: Router,
  ) {
    this.dropHandler = new MapDropHandler(dropService, crypto, fileService);

    // ✅ reload markers whenever login state changes
    effect(() => {
      const loggedIn = this.isLoggedIn();
      if (loggedIn) {
        this.loadVisibleDropMarkers();
      } else {
        this.visibleDrops = [];
        this.clearMarkers();
      }
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
    this.initOverlay();     // projection readiness
    this.initCanvases();
    this.handleResize();

    window.addEventListener('resize', () => this.handleResize());

    // ✅ redraw markers whenever map view changes
    this.map.addListener('bounds_changed', () => this.redrawGridAndMarkers());
    this.map.addListener('zoom_changed', () => this.redrawGridAndMarkers());
    this.map.addListener('dragend', () => this.redrawGridAndMarkers());
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
      mapTypeId: google.maps.MapTypeId.ROADMAP,
    });

    this.mapEvents = new MapEvents(
      this.eventLayer.nativeElement,
      this.map,
      (coords: CellCoords, lat: number, lng: number) => {
        this.ngZone.run(() => this.lookupDrop(lat, lng));
      },
      (coords: CellCoords | null) => {
        this.hoveredCell = coords;
        if (coords) this.renderer.drawHoverCell(this.map, coords, this.hoverCanvas.nativeElement);
        else this.renderer.clearHover(this.hoverCanvas.nativeElement);
      },
    );

    this.mapEvents.bind();

    // optional geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          this.map.setZoom(this.MIN_ZOOM_FOR_GRID);
        },
        () => { },
      );
    }
  }

  toggleSatellite() {
    this.isSatellite = !this.isSatellite;

    this.map.setMapTypeId(
      this.isSatellite ? google.maps.MapTypeId.SATELLITE : google.maps.MapTypeId.ROADMAP,
    );

    if (this.isSatellite) {
      this.map.setHeading?.(0);
      this.map.setTilt?.(0);

      this.lockHeadingListener?.remove();
      this.lockTiltListener?.remove();

      this.lockHeadingListener = this.map.addListener('heading_changed', () => {
        if ((this.map.getHeading?.() ?? 0) !== 0) this.map.setHeading?.(0);
      });

      this.lockTiltListener = this.map.addListener('tilt_changed', () => {
        if ((this.map.getTilt?.() ?? 0) !== 0) this.map.setTilt?.(0);
      });
    } else {
      this.lockHeadingListener?.remove();
      this.lockTiltListener?.remove();
      this.lockHeadingListener = undefined;
      this.lockTiltListener = undefined;
    }
  }


  private initCanvases() {
    this.gridCtx = this.gridCanvas.nativeElement.getContext('2d')!;
    this.hoverCtx = this.hoverCanvas.nativeElement.getContext('2d')!;
    this.markersCtx = this.markersCanvas.nativeElement.getContext('2d')!;

    this.renderer = new MapRenderer(this.gridCtx, this.hoverCtx);
  }

  private handleResize() {
    const el = this.mapContainer.nativeElement;

    // ✅ must resize ALL canvases
    for (const canvas of [this.gridCanvas.nativeElement, this.hoverCanvas.nativeElement, this.markersCanvas.nativeElement]) {
      canvas.width = el.clientWidth;
      canvas.height = el.clientHeight;
    }

    this.redrawGridAndMarkers();
  }

  private redrawAll() {
    if (!this.map || !this.renderer) return;

    this.renderer.drawGrid(this.map, this.gridCanvas.nativeElement);
    this.drawVisibleMarkers();
  }

  // ---------------------------------------------------------------------------
  // OVERLAY (projection)
  // ---------------------------------------------------------------------------

  private initOverlay() {
    this.overlay = new google.maps.OverlayView();

    this.overlay.onAdd = () => { };
    this.overlay.onRemove = () => { };

    // ✅ This is called when projection exists (critical!)
    this.overlay.draw = () => {
      // draw markers whenever overlay draws (projection ready + map moved)
      this.redrawGridAndMarkers();
    };

    this.overlay.setMap(this.map);
  }

  // ---------------------------------------------------------------------------
  // MARKERS
  // ---------------------------------------------------------------------------

  private clearMarkers() {
    if (!this.markersCtx) return;
    const c = this.markersCanvas?.nativeElement;
    if (!c) return;
    this.markersCtx.clearRect(0, 0, c.width, c.height);
  }

  private loadVisibleDropMarkers() {
    if (!this.isLoggedIn()) return;

    this.dropHandler.getVisibleDrops().subscribe({
      next: (drops: any[]) => {
        this.visibleDrops = drops || [];
        // try drawing immediately
        this.drawVisibleMarkers();
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Failed to load visible drops', err),
    });
  }

  private drawVisibleMarkers() {
    if (!this.overlay || !this.markersCtx || !this.map) return;

    const projection = this.overlay.getProjection();
    if (!projection) return;

    const zoom = this.map.getZoom() ?? 0;

    console.log('projection ok', !!projection, 'zoom', zoom, 'drops', this.visibleDrops.length);

    if (zoom < this.MIN_ZOOM_FOR_GRID) {
      this.clearMarkers();
      return;
    }

    const canvas = this.markersCanvas.nativeElement;
    const ctx = this.markersCtx;

    // Clear marker layer only
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ✅ quick sanity: if you don't see this square, it's CSS/layering not math
    // ctx.fillStyle = 'red';
    // ctx.fillRect(20, 20, 12, 12);

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#22c55e';
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.7)';
    ctx.lineWidth = 2;

    for (const d of this.visibleDrops) {
      const lat = d.lat ?? d.location?.coordinates?.[0];
      const lng = d.lng ?? d.location?.coordinates?.[1];
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;

      const ll = new google.maps.LatLng(lat, lng);

      // ✅ IMPORTANT: use container pixels if available
      const point =
        (projection as any).fromLatLngToContainerPixel?.(ll) ??
        projection.fromLatLngToDivPixel(ll);

      if (!point) continue;

      // If these are negative or huge, it means wrong pixel space
      // console.log('pt', point.x, point.y, 'canvas', canvas.width, canvas.height);

      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(point.x, point.y, 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }



  private redrawGridAndMarkers() {
    this.renderer.drawGrid(this.map, this.gridCanvas.nativeElement);
    this.drawVisibleMarkers(); // draws dots AFTER grid
  }

  // ---------------------------------------------------------------------------
  // DROP FLOW
  // ---------------------------------------------------------------------------

  lookupDrop(lat: number, lng: number) {
    this.dropHandler.findDrop(lat, lng).subscribe({
      next: (drops: any[]) => {
        if (!drops || drops.length === 0) {
          this.openDropModal(lat, lng);
        } else {
          this.existingDrops = drops.map((d) => ({ ...d, unlocked: false, decrypted: null }));
          this.existingModalOpen = true;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.openDropModal(lat, lng);
        this.cdr.markForCheck();
      },
    });
  }

  openDropModal(lat: number, lng: number) {
    this.dropLat = lat;
    this.dropLng = lng;
    this.dropError = null;
    this.dropModalOpen = true;
    this.cdr.markForCheck();
  }

  closeDropModal() {
    this.dropModalOpen = false;
    this.cdr.markForCheck();
  }

  closeExistingModal() {
    this.existingModalOpen = false;
    this.existingDrops = [];
    this.decryptError = null;
    this.cdr.markForCheck();
  }

  onCreateDrop(ev: {
    message: string;
    passwordLock: boolean;
    password?: string;
    hidden: boolean;
    otcLock: boolean;
    gpsLock: boolean;
    file?: File;
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
      hidden: ev.hidden,
      otcLock: ev.otcLock,
      gpsLock: ev.gpsLock,
      file: ev.file,
    }).subscribe({
      next: () => {
        this.dropSaving = false;
        this.dropModalOpen = false;

        // ✅ refresh markers after creating a visible drop
        this.loadVisibleDropMarkers();

        this.cdr.markForCheck();
      },
      error: () => {
        this.dropSaving = false;
        this.dropError = 'Failed to save drop';
        this.cdr.markForCheck();
      },
    });
  }

  onUnlockDrop(ev: {
    drop: any;
    password?: string;
    otc?: number | string;
    requireGps: boolean;
    generateOtc?: boolean;
  }) {
    const d = ev.drop;

    // ✅ per-drop flags (persist between clicks)
    d.__pwOk ??= !d.passwordLock;
    d.__otcOk ??= !d.otcLock;
    d.__gpsOk ??= !d.gpsLock;

    this.decryptError = null;
    this.cdr.markForCheck();

    const setBusy = (v: boolean) => {
      this.decrypting = v;
      this.cdr.markForCheck();
    };

    const performDecrypt = () => {
      setBusy(true);

      this.dropHandler
        .decrypt(d, (ev.password ?? '') as string)
        .then((text) => {
          d.unlocked = true;
          d.decrypted = text;
          setBusy(false);
        })
        .catch((err) => {
          console.error(err);
          this.decryptError = 'Could not decrypt (wrong password or drop not unlocked yet)';
          setBusy(false);
        });
    };

    // ---------------------------------------------------------------------------
    // 1) Generate OTC
    // ---------------------------------------------------------------------------
    if (ev.generateOtc) {
      setBusy(true);

      this.dropService.generateOtc(d._id).subscribe({
        next: () => {
          d.otcGenerated = true;
          setBusy(false);
        },
        error: (err) => {
          console.error(err);
          this.decryptError = 'Could not generate code';
          setBusy(false);
        },
      });

      return;
    }

    // ---------------------------------------------------------------------------
    // 2) Verify Password (server-side) – sets d.__pwOk
    // IMPORTANT: needs backend POST /drop/check-password/:id
    // ---------------------------------------------------------------------------
    const verifyPassword = (): Promise<void> =>
      new Promise((resolve, reject) => {
        if (!d.passwordLock || d.__pwOk) return resolve();

        const pw = (ev.password ?? '').trim();
        if (!pw) {
          this.decryptError = 'Password required';
          this.cdr.markForCheck();
          return reject();
        }

        setBusy(true);
        this.dropService.checkPassword(d._id, pw).subscribe({
          next: () => {
            d.__pwOk = true;
            setBusy(false);
            resolve();
          },
          error: (err) => {
            console.error(err);
            d.__pwOk = false;
            this.decryptError = 'Incorrect password';
            setBusy(false);
            reject();
          },
        });
      });

    // ---------------------------------------------------------------------------
    // 3) Verify OTC – sets d.__otcOk
    // ---------------------------------------------------------------------------
    const verifyOtc = (): Promise<void> =>
      new Promise((resolve, reject) => {
        if (!d.otcLock || d.__otcOk) return resolve();

        const codeRaw = ev.otc;
        const code = typeof codeRaw === 'string' ? Number(codeRaw) : codeRaw;

        if (!code) {
          this.decryptError = 'One-time code required';
          this.cdr.markForCheck();
          return reject();
        }

        setBusy(true);
        this.dropService.checkOtc(d._id, code).subscribe({
          next: () => {
            d.__otcOk = true;
            setBusy(false);
            resolve();
          },
          error: (err) => {
            console.error(err);

            // if backend returns "already verified" treat it as ok
            const msg = err?.error?.message ?? '';
            if (msg.toLowerCase().includes('already')) {
              d.__otcOk = true;
              setBusy(false);
              return resolve();
            }

            d.__otcOk = false;
            this.decryptError = 'Invalid one-time code';
            setBusy(false);
            reject();
          },
        });
      });

    // ---------------------------------------------------------------------------
    // 4) Verify GPS – sets d.__gpsOk
    // ---------------------------------------------------------------------------
    const verifyGps = (): Promise<void> =>
      new Promise((resolve, reject) => {
        if (!d.gpsLock || d.__gpsOk) return resolve();

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setBusy(true);

            this.dropService
              .checkGps(d._id, pos.coords.latitude, pos.coords.longitude)
              .subscribe({
                next: () => {
                  d.__gpsOk = true;
                  setBusy(false);
                  resolve();
                },
                error: (err) => {
                  console.error(err);
                  d.__gpsOk = false;
                  this.decryptError = 'GPS location incorrect';
                  setBusy(false);
                  reject();
                },
              });
          },
          (err) => {
            console.error(err);
            d.__gpsOk = false;
            this.decryptError = 'GPS permission denied';
            this.cdr.markForCheck();
            reject();
          },
        );
      });

    // ---------------------------------------------------------------------------
    // 5) Step-by-step unlock flow:
    // password → otc → gps → decrypt
    // ---------------------------------------------------------------------------
    verifyPassword()
      .then(() => verifyOtc())
      .then(() => verifyGps())
      .then(() => performDecrypt())
      .catch(() => {
        // error already set
        setBusy(false);
      });
  }



  onDownloadDropFile(drop: any) {
    const fileId = drop.fileId;
    if (!fileId) return;

    const downloadName = drop.fileName || 'file';

    this.fileService.getDownloadPresignedUrl(fileId, downloadName).subscribe({
      next: (res) => window.open(res.url, '_blank', 'noopener'),
      error: () => {
        this.decryptError = 'Could not get download link';
        this.cdr.markForCheck();
      },
    });
  }

  goLogin() {
    this.closeDropModal();
    this.router.navigate(['/auth/login'], { queryParams: { returnUrl: '/map' } });
  }

  goRegister() {
    this.closeDropModal();
    this.router.navigate(['/auth/register'], { queryParams: { returnUrl: '/map' } });
  }
}
