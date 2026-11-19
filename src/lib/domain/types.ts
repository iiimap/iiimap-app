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
  severity: number; // ระดับ 0–9 (0 = ปกติ) ยิ่งมากยิ่งร้ายแรง ใช้ตัดสินสีของไลน์แบบ ByLine
  /** สถานะของระบบ: 'offline' = ขาดการเชื่อมต่อ (มีเสมอ ลบไม่ได้ ไม่มีระดับ ไม่นับใน ByLine) */
  system?: 'offline';
}

/** ตั้งค่าการนับข้อมูล Andon ที่ใช้คำนวณ KPI */
export interface MetricsConfig {
  failureStates: string[]; // สถานะที่นับเป็น "เสีย" (ใช้นับ failures)
}

/** KPI ที่ผู้ใช้สร้างและตั้งสูตรเอง */
export interface Kpi {
  id: string;
  name: string; // ชื่อที่ผู้ใช้ตั้ง
  formula: string; // สูตรจากตัวแปรของระบบ Andon
  unit: string; // หน่วย เช่น นาที, %, ครั้ง
  target: number | null; // ค่าเป้าหมาย (ไม่ตั้งก็ได้)
  better: 'lower' | 'higher'; // ค่าต่ำดี (เช่น MTTR) หรือค่าสูงดี (เช่น MTBF)
}

/**
 * เรื่อง Andon 1 ครั้ง (บันทึกเหตุการณ์ ใช้คำนวณ KPI)
 * ขั้นตอน: เปิดเรื่อง → รับเรื่อง → ส่งต่อ (ถ้าจำเป็น) → ปิดเรื่อง พร้อมสาเหตุ
 */
export interface Incident {
  id: string;
  assetId: string;
  lineId: string | null; // ไลน์ตอนเปิดเรื่อง
  stateId: string; // สถานะ Andon ที่แจ้ง เช่น alarm, material
  openedAt: number; // เวลา (ms)
  ackAt: number | null; // รับเรื่อง
  escalatedAt: number | null; // ส่งต่อ
  resolvedAt: number | null; // ปิดเรื่อง
  reason: string | null; // สาเหตุตอนปิดเรื่อง
}

export type IncidentStage = 'open' | 'ack' | 'escalated' | 'resolved';

/** โมดูลที่ใช้ระบบ Audit กลาง */
export type AuditModule = 'fire' | 'fiveS';

/**
 * บันทึกการตรวจ 1 ครั้ง (ใช้ร่วมกันทั้งถังดับเพลิงและ 5ส)
 * - fire:  targetId = id ของถังดับเพลิง, checks = ผ่าน/ไม่ผ่าน ต่อข้อ
 * - fiveS: targetId = id ของไลน์, scores = คะแนน 0–5 ต่อหัวข้อ
 */
export interface AuditRecord {
  id: string;
  module: AuditModule;
  targetId: string;
  at: number; // วันที่ตรวจ (ms)
  inspector: string;
  checks: Record<string, boolean>; // fire: ชื่อข้อ → ผ่านไหม
  scores: Record<string, number>; // fiveS: ชื่อหัวข้อ → 0–5
  passed: boolean;
  score: number | null; // fiveS: คะแนนรวมเป็น %
  note: string;
}

export interface AuditConfig {
  fire: { intervalDays: number; dueSoonDays: number; checklist: string[] };
  fiveS: { intervalDays: number; dueSoonDays: number; categories: string[]; passScore: number };
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
  kpis: Kpi[];
  reasons: string[]; // สาเหตุ (reason code) ให้เลือกตอนปิดเรื่อง
  incidents: Incident[]; // ประวัติการแจ้ง Andon
  audits: AuditRecord[]; // ประวัติการตรวจ (ถังดับเพลิง, 5ส)
  auditConfig: AuditConfig;
  assets: Asset[];
}
