export type DropAction =
  | { type: 'pw'; drop: any; password: string }
  | { type: 'otc-generate'; drop: any }
  | { type: 'otc-verify'; drop: any; code: number | string }
  | { type: 'gps'; drop: any }
  | { type: 'decrypt'; drop: any; password: string };