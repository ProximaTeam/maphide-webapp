import { getCellBounds } from './map-grid';
import type { CellCoords } from './map-grid';

export class MapRenderer {
    constructor(
        private gridCtx: CanvasRenderingContext2D,
        private hoverCtx: CanvasRenderingContext2D
    ) { }

    clearHover(canvas: HTMLCanvasElement) {
        this.hoverCtx.clearRect(0, 0, canvas.width, canvas.height);
    }

    drawGrid(map: google.maps.Map, canvas: HTMLCanvasElement) {
        const ctx = this.gridCtx;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const zoom = map.getZoom() ?? 0;
        if (zoom < 19) return;

        const bounds = map.getBounds();
        const projection = map.getProjection();
        const center = map.getCenter();

        if (!bounds || !projection || !center) return;

        const scale = Math.pow(2, zoom);
        const centerWorld = projection.fromLatLngToPoint(center);
        if (!centerWorld) return;

        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();

        const startX = Math.floor(sw.lng() / 0.000055) - 1;
        const endX = Math.ceil(ne.lng() / 0.000055) + 1;
        const startY = Math.floor(sw.lat() / 0.000045) - 1;
        const endY = Math.ceil(ne.lat() / 0.000045) + 1;

        ctx.strokeStyle = "rgba(14,165,233,0.75)";
        ctx.lineWidth = 1;

        // Draw lines
        for (let x = startX; x <= endX; x++) {
            const lng = x * 0.000055;
            this.drawVertical(map, ctx, lng);
        }

        for (let y = startY; y <= endY; y++) {
            const lat = y * 0.000045;
            this.drawHorizontal(map, ctx, lat);
        }
    }

    drawHoverCell(map: google.maps.Map, cell: CellCoords, canvas: HTMLCanvasElement) {
        const ctx = this.hoverCtx;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const projection = map.getProjection();
        const center = map.getCenter();
        if (!projection || !center) return;

        const centerWorld = projection.fromLatLngToPoint(center);
        if (!centerWorld) return;

        const scale = Math.pow(2, map.getZoom()!);
        const bounds = getCellBounds(cell);

        const nw = this.latLngToPixel(bounds.north, bounds.west, projection, centerWorld, scale, canvas);
        const se = this.latLngToPixel(bounds.south, bounds.east, projection, centerWorld, scale, canvas);

        const w = se.x - nw.x;
        const h = se.y - nw.y;

        ctx.fillStyle = 'rgba(14,165,233,0.25)';
        ctx.fillRect(nw.x, nw.y, w, h);

        ctx.strokeStyle = 'rgba(14,165,233,1)';
        ctx.lineWidth = 2;
        ctx.strokeRect(nw.x, nw.y, w, h);
    }

    private latLngToPixel(
        lat: number,
        lng: number,
        projection: google.maps.Projection,
        centerWorld: google.maps.Point,
        scale: number,
        canvas: HTMLCanvasElement
    ) {
        const world = projection.fromLatLngToPoint(new google.maps.LatLng(lat, lng));
        if (!world) return { x: -9999, y: -9999 };
        return {
            x: (world.x - centerWorld.x) * scale + canvas.width / 2,
            y: (world.y - centerWorld.y) * scale + canvas.height / 2,
        };
    }

    private drawVertical(
        map: google.maps.Map,
        ctx: CanvasRenderingContext2D,
        lng: number
    ) {
        const projection = map.getProjection();
        const center = map.getCenter();
        if (!projection || !center) return;

        const zoom = map.getZoom()!;
        const scale = Math.pow(2, zoom);
        const centerWorld = projection.fromLatLngToPoint(center);
        if (!centerWorld) return;

        const bounds = map.getBounds();
        if (!bounds) return;

        const north = bounds.getNorthEast().lat();
        const south = bounds.getSouthWest().lat();

        const a = this.latLngToPixel(north, lng, projection, centerWorld, scale, ctx.canvas);
        const b = this.latLngToPixel(south, lng, projection, centerWorld, scale, ctx.canvas);

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
    }

    private drawHorizontal(
        map: google.maps.Map,
        ctx: CanvasRenderingContext2D,
        lat: number
    ) {
        const projection = map.getProjection();
        const center = map.getCenter();
        if (!projection || !center) return;

        const zoom = map.getZoom()!;
        const scale = Math.pow(2, zoom);
        const centerWorld = projection.fromLatLngToPoint(center);
        if (!centerWorld) return;

        const bounds = map.getBounds();
        if (!bounds) return;

        const west = bounds.getSouthWest().lng();
        const east = bounds.getNorthEast().lng();

        const a = this.latLngToPixel(lat, west, projection, centerWorld, scale, ctx.canvas);
        const b = this.latLngToPixel(lat, east, projection, centerWorld, scale, ctx.canvas);

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
    }


}
