export const GRID_DEG_LAT = 0.000045;
export const GRID_DEG_LNG = 0.000055;

export interface CellCoords {
  x: number;
  y: number;
}

export function getCellCoords(lat: number, lng: number): CellCoords {
  return {
    x: Math.floor(lng / GRID_DEG_LNG),
    y: Math.floor(lat / GRID_DEG_LAT)
  };
}

export function getCellBounds(cell: CellCoords) {
  return {
    south: cell.y * GRID_DEG_LAT,
    north: (cell.y + 1) * GRID_DEG_LAT,
    west: cell.x * GRID_DEG_LNG,
    east: (cell.x + 1) * GRID_DEG_LNG,
  };
}
