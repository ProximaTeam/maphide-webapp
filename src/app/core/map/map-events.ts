import { getCellCoords } from './map-grid';
import type { CellCoords } from './map-grid';

export class MapEvents {
  hovered: CellCoords | null = null;

  constructor(
    private map: google.maps.Map,
    private onCellClick: (coords: CellCoords, lat: number, lng: number) => void,
    private onCellHover: (coords: CellCoords | null) => void
  ) {}

  bind() {
    this.map.addListener('mousemove', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const coords = getCellCoords(e.latLng.lat(), e.latLng.lng());
      this.hovered = coords;
      this.onCellHover(coords);
    });

    this.map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const coords = getCellCoords(e.latLng.lat(), e.latLng.lng());
      this.onCellClick(coords, e.latLng.lat(), e.latLng.lng());
    });
  }
}
