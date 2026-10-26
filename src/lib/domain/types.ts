// โครงข้อมูลหลักของ iiiMap: Tenant → Site → Area → Asset
export type AssetStatus = 'running' | 'idle' | 'alarm' | 'offline';
export type AssetKind = 'machine' | 'conveyor' | 'station' | 'dock';

export interface Asset {
  id: string;
  name: string;
  kind: AssetKind;
  areaId: string;
  x: number; // ตำแหน่งบนผัง (เมตร)
  z: number;
  w: number; // ขนาด
  d: number;
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
