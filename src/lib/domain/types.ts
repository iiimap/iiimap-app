// โครงข้อมูลหลักของ iiiMap: Tenant → Site → Area → Asset
export type AssetStatus = 'running' | 'idle' | 'alarm' | 'offline';

/** id ของโมเดลใน MODELS (catalog.ts) เช่น 'cnc', 'conveyor' */
export type AssetKind = string;

export interface Asset {
  id: string;
  name: string;
  kind: AssetKind;
  areaId: string | null;
  x: number; // ตำแหน่งกึ่งกลางบนผัง (เมตร)
  z: number;
  w: number; // ความกว้าง (แกน x ก่อนหมุน)
  d: number; // ความลึก (แกน z ก่อนหมุน)
  rot: number; // จำนวนครั้งที่หมุน 90° (0–3)
  status: AssetStatus;
}

export interface Area {
  id: string;
  name: string;
  x: number;
  z: number;
  w: number;
  d: number;
  color: string;
}

export interface Site {
  id: string;
  tenantId: string;
  name: string;
  width: number;
  depth: number;
  areas: Area[];
  assets: Asset[];
}
