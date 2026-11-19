import type { AndonState, AuditConfig, Kpi, MetricsConfig } from './types';

// สถานะ Andon ตั้งต้น (ผู้ใช้แก้ชื่อ สี และระดับความร้ายแรงได้ทั้งหมด)
export const SEVERITY_MIN = 0;
export const SEVERITY_MAX = 9;

export const OFFLINE_STATE: AndonState = { id: 'offline', name: 'ขาดการเชื่อมต่อ', color: '#94a3b8', severity: 0, system: 'offline' };

export const DEFAULT_ANDON_STATES: AndonState[] = [
  { id: 'running', name: 'ทำงานปกติ', color: '#16a34a', severity: 0 },
  { id: 'idle', name: 'รอ / ว่าง', color: '#f59e0b', severity: 1 },
  { id: 'material', name: 'เรียกวัตถุดิบ', color: '#2563eb', severity: 2 },
  { id: 'alarm', name: 'เครื่องเสีย', color: '#dc2626', severity: 3 },
  OFFLINE_STATE
];

/** ระดับต้องเป็นจำนวนเต็ม 0–9 (0 = ปกติ ไม่มีปัญหา) */
export const clampSeverity = (v: number) =>
  Math.min(SEVERITY_MAX, Math.max(SEVERITY_MIN, Math.round(Number.isFinite(v) ? v : SEVERITY_MIN)));

export const DEFAULT_METRICS: MetricsConfig = {
  failureStates: ['alarm']
};

// สาเหตุตั้งต้น (ผู้ใช้เพิ่ม/แก้/ลบได้)
export const DEFAULT_REASONS = [
  'เครื่องจักรเสีย',
  'รอวัตถุดิบ',
  'ปัญหาคุณภาพ',
  'เปลี่ยนแม่พิมพ์ / Setup',
  'ขาดพนักงาน',
  'อื่นๆ'
];

// ค่าเริ่มต้นการตรวจ (ผู้ใช้แก้ได้)
export const DEFAULT_AUDIT_CONFIG: AuditConfig = {
  fire: {
    intervalDays: 30, // ตรวจทุกเดือน
    dueSoonDays: 7, // เตือนล่วงหน้า 7 วัน
    checklist: [
      'เข็มแรงดันอยู่ในช่องสีเขียว',
      'สลักและซีลอยู่ครบ',
      'สายฉีดและหัวฉีดไม่ชำรุด',
      'ตัวถังไม่บุบ ไม่เป็นสนิม',
      'ป้ายชัดเจน ไม่มีสิ่งกีดขวาง',
      'ยังไม่หมดอายุ'
    ]
  },
  fiveS: {
    intervalDays: 30,
    dueSoonDays: 7,
    categories: ['สะสาง', 'สะดวก', 'สะอาด', 'สุขลักษณะ', 'สร้างนิสัย'],
    passScore: 60 // ผ่านเมื่อคะแนนรวม ≥ 60%
  }
};

/** เก็บประวัติการแจ้งล่าสุดไม่เกินเท่านี้ (ในเบราว์เซอร์) */
export const INCIDENT_LIMIT = 5000;

// KPI ตั้งต้น (ผู้ใช้แก้ชื่อ สูตร หน่วย เป้าหมาย หรือลบได้ทั้งหมด)
export const DEFAULT_KPIS: Kpi[] = [
  { id: 'kpi-mttr', name: 'MTTR', formula: 'repairTime / failures', unit: 'นาที', target: 60, better: 'lower' },
  { id: 'kpi-mtbf', name: 'MTBF', formula: 'runTime / failures', unit: 'นาที', target: 2000, better: 'higher' }
];

// สีประจำไลน์ที่สุ่มให้ตอนสร้างไลน์ใหม่
export const LINE_COLORS = ['#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5', '#0d9488', '#c026d3'];
