// โครงข้อมูลหลักของ iiiMap: Tenant → Site → Line → Asset

/** id ของสถานะ Andon (ผู้ใช้สร้างเพิ่มเองได้ ค่า default: running / idle / alarm / offline / material) */
export type AssetStatus = string;

/** id ของโมเดลใน MODELS (catalog.ts) เช่น 'cnc', 'conveyor' */
export type AssetKind = string;

export interface Asset {
  id: string;
  name: string;
  kind: AssetKind;
  lineId: string | null; // อยู่ได้ไลน์เดียว
  x: number; // ตำแหน่งกึ่งกลางบนผัง (เมตร)
  z: number;
  w: number; // ความกว้าง (แกน x ก่อนหมุน)
  d: number; // ความลึก (แกน z ก่อนหมุน)
  rot: number; // จำนวนครั้งที่หมุน 90° (0–3)
  andon: boolean; // เปิดใช้ไฟ Andon หรือไม่ (ได้เฉพาะประเภทที่รองรับ)
  status: AssetStatus; // id ของสถานะ Andon
}

/** โหมดการเชื่อม Andon ของไลน์ */
export type LineMode = 'byLine' | 'byStation';

export interface Line {
  id: string;
  name: string;
  mode: LineMode;
  color: string; // สีประจำไลน์ (ใช้ไฮไลต์และกรอบ)
}

/** สถานะ Andon ที่ผู้ใช้กำหนดสีและความหมายเอง */
export interface AndonState {
  id: string;
  name: string;
  color: string; // #rrggbb
  severity: number; // ยิ่งมากยิ่งร้ายแรง ใช้ตัดสินสีของไลน์แบบ ByLine
}

/** ตั้งค่าตัวชี้วัด Andon */
export interface MetricsConfig {
  mttr: string; // สูตร
  mtbf: string;
  failureStates: string[]; // สถานะที่นับเป็น "เสีย"
}

export interface Site {
  id: string;
  tenantId: string;
  name: string;
  width: number;
  depth: number;
  lines: Line[];
  andonStates: AndonState[];
  metrics: MetricsConfig;
  assets: Asset[];
}
