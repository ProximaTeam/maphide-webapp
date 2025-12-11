// src/app/core/map/map-events.ts
import { getCellCoords, CellCoords } from './map-grid';

export class MapEvents {
  hovered: CellCoords | null = null;

  private isMouseDown = false;
  private dragStart: { x: number; y: number } | null = null;
  private dragMoved = false;
  private readonly DRAG_THRESHOLD = 5; // px

  constructor(
    private el: HTMLElement,
    private map: google.maps.Map,
    private onCellClick: (coords: CellCoords, lat: number, lng: number) => void,
    private onHoverCell: (coords: CellCoords | null) => void,
    private MIN_ZOOM = 19
  ) {}

  bind() {
    // MOUSE DOWN -------------------------------------------------------------
    this.el.addEventListener('mousedown', (e) => {
      this.isMouseDown = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.dragMoved = false;

      // clear hover immediately when starting drag
      this.onHoverCell(null);
      this.hovered = null;
    });

    // MOUSE MOVE -------------------------------------------------------------
    this.el.addEventListener('mousemove', (e) => {
      // If mouse is held, track drag distance, but DO NOT hover
      if (this.isMouseDown) {
        if (this.dragStart) {
          const dx = e.clientX - this.dragStart.x;
          const dy = e.clientY - this.dragStart.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > this.DRAG_THRESHOLD * this.DRAG_THRESHOLD) {
            this.dragMoved = true;
          }
        }
        // no hover while dragging
        return;
      }

      // Not dragging → normal hover logic
      if (!this.map || this.map.getZoom()! < this.MIN_ZOOM) {
        this.onHoverCell(null);
        this.hovered = null;
        return;
      }

      const latLng = this.screenToLatLng({ x: e.clientX, y: e.clientY });
      if (!latLng) {
        this.onHoverCell(null);
        this.hovered = null;
        return;
      }

      const coords = getCellCoords(latLng.lat(), latLng.lng());
      this.hovered = coords;
      this.onHoverCell(coords);
    });

    // MOUSE UP ---------------------------------------------------------------
    this.el.addEventListener('mouseup', (e) => {
      const wasDrag = this.dragMoved;

      this.isMouseDown = false;
      this.dragStart = null;
      this.dragMoved = false;

      // If it was a drag → don't treat as click
      if (wasDrag) {
        return;
      }

      // Treat as click (but only if zoomed in enough)
      if (!this.map || this.map.getZoom()! < this.MIN_ZOOM) {
        return;
      }

      const latLng = this.screenToLatLng({ x: e.clientX, y: e.clientY });
      if (!latLng) return;

      const coords = getCellCoords(latLng.lat(), latLng.lng());
      this.onCellClick(coords, latLng.lat(), latLng.lng());
    });

    // MOUSE LEAVE ------------------------------------------------------------
    this.el.addEventListener('mouseleave', () => {
      this.isMouseDown = false;
      this.dragStart = null;
      this.dragMoved = false;
      this.hovered = null;
      this.onHoverCell(null);
    });
  }

  // -------------------------------------------------------------------------
  // UTIL: screen coordinate → LatLng
  // -------------------------------------------------------------------------
  private screenToLatLng(pt: { x: number; y: number }): google.maps.LatLng | null {
    const projection = this.map.getProjection();
    const bounds = this.map.getBounds();
    const center = this.map.getCenter();
    const zoom = this.map.getZoom();

    if (!projection || !bounds || !center || zoom == null) return null;

    const topRight = projection.fromLatLngToPoint(bounds.getNorthEast());
    const bottomLeft = projection.fromLatLngToPoint(bounds.getSouthWest());
    const centerWorld = projection.fromLatLngToPoint(center);
    if (!topRight || !bottomLeft || !centerWorld) return null;

    const scale = Math.pow(2, zoom);

    const mapDiv = this.map.getDiv();
    const rect = mapDiv.getBoundingClientRect();
    const x = pt.x - rect.left;
    const y = pt.y - rect.top;

    const worldX = centerWorld.x + (x - rect.width / 2) / scale;
    const worldY = centerWorld.y + (y - rect.height / 2) / scale;

    const worldPoint = new google.maps.Point(worldX, worldY);
    return projection.fromPointToLatLng(worldPoint);
  }
}
