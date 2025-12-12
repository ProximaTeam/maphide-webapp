// src/app/core/map/map-events.ts
import { getCellCoords, CellCoords } from './map-grid';

export class MapEvents {
  hovered: CellCoords | null = null;

  private isMouseDown = false;
  private dragStart: { x: number; y: number } | null = null;
  private dragMoved = false;
  private readonly DRAG_THRESHOLD = 5; // px

  private touchStart: { x: number; y: number } | null = null;
  private touchMoved = false;

  constructor(
    private el: HTMLElement,
    private map: google.maps.Map,
    private onCellClick: (coords: CellCoords, lat: number, lng: number) => void,
    private onHoverCell: (coords: CellCoords | null) => void,
    private MIN_ZOOM = 19
  ) {}

  bind() {
    // ---------------------------------------------------------------
    // MOUSE EVENTS
    // ---------------------------------------------------------------

    this.el.addEventListener('mousedown', (e) => {
      this.isMouseDown = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.dragMoved = false;

      this.onHoverCell(null);
      this.hovered = null;
    });

    this.el.addEventListener('mousemove', (e) => {
      if (this.isMouseDown) {
        if (this.dragStart) {
          const dx = e.clientX - this.dragStart.x;
          const dy = e.clientY - this.dragStart.y;

          if (dx * dx + dy * dy > this.DRAG_THRESHOLD * this.DRAG_THRESHOLD) {
            this.dragMoved = true;
          }
        }
        return;
      }

      this.handleHover(e.clientX, e.clientY);
    });

    this.el.addEventListener('mouseup', (e) => {
      const wasDrag = this.dragMoved;

      this.isMouseDown = false;
      this.dragStart = null;
      this.dragMoved = false;

      if (!wasDrag) {
        this.handleClick(e.clientX, e.clientY);
      }
    });

    this.el.addEventListener('mouseleave', () => {
      this.isMouseDown = false;
      this.dragStart = null;
      this.dragMoved = false;
      this.hovered = null;
      this.onHoverCell(null);
    });

    // ---------------------------------------------------------------
    // TOUCH EVENTS (Mobile)
    // ---------------------------------------------------------------

    this.el.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      this.touchStart = { x: t.clientX, y: t.clientY };
      this.touchMoved = false;

      this.onHoverCell(null);
      this.hovered = null;
    });

    this.el.addEventListener('touchmove', (e) => {
      if (!this.touchStart) return;

      const t = e.touches[0];
      const dx = t.clientX - this.touchStart.x;
      const dy = t.clientY - this.touchStart.y;

      if (dx * dx + dy * dy > this.DRAG_THRESHOLD * this.DRAG_THRESHOLD) {
        this.touchMoved = true;
      }
    });

    this.el.addEventListener('touchend', (e) => {
      if (!this.touchStart) return;

      const wasDrag = this.touchMoved;
      const t = e.changedTouches[0];

      this.touchStart = null;
      this.touchMoved = false;

      if (!wasDrag) {
        this.handleClick(t.clientX, t.clientY);
      }
    });
  }

  // -------------------------------------------------------------------------
  // HELPER: Hover logic shared by mouse + touch
  // -------------------------------------------------------------------------
  private handleHover(x: number, y: number) {
    if (!this.map || this.map.getZoom()! < this.MIN_ZOOM) {
      this.onHoverCell(null);
      this.hovered = null;
      return;
    }

    const latLng = this.screenToLatLng({ x, y });
    if (!latLng) {
      this.onHoverCell(null);
      this.hovered = null;
      return;
    }

    const coords = getCellCoords(latLng.lat(), latLng.lng());
    this.hovered = coords;
    this.onHoverCell(coords);
  }

  // -------------------------------------------------------------------------
  // HELPER: Click logic shared by mouse + touch
  // -------------------------------------------------------------------------
  private handleClick(x: number, y: number) {
    if (!this.map || this.map.getZoom()! < this.MIN_ZOOM) return;

    const latLng = this.screenToLatLng({ x, y });
    if (!latLng) return;

    const coords = getCellCoords(latLng.lat(), latLng.lng());
    this.onCellClick(coords, latLng.lat(), latLng.lng());
  }

  // -------------------------------------------------------------------------
  // UTIL: screen coordinate → LatLng
  // -------------------------------------------------------------------------
  private screenToLatLng(pt: { x: number; y: number }): google.maps.LatLng | null {
    const projection = this.map.getProjection();
    const center = this.map.getCenter();
    const bounds = this.map.getBounds();
    const zoom = this.map.getZoom();

    if (!projection || !center || !bounds || zoom == null) return null;

    const centerPt = projection.fromLatLngToPoint(center);
    const rect = this.map.getDiv().getBoundingClientRect();
    if (!centerPt) return null;

    const scale = Math.pow(2, zoom);

    const worldX = centerPt.x + (pt.x - (rect.left + rect.width / 2)) / scale;
    const worldY = centerPt.y + (pt.y - (rect.top + rect.height / 2)) / scale;

    return projection.fromPointToLatLng(new google.maps.Point(worldX, worldY));
  }
}
