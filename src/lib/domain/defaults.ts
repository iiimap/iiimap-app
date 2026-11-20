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
    passScore: 60, // ผ่านเมื่อคะแนนรวม ≥ 60%
    goodScore: 80 // ดี (สีเขียว) เมื่อ ≥ 80%
  }
};

/** แม่แบบรายการหัวข้อ เลือกใช้ได้ในศูนย์ตั้งค่า */
export const AUDIT_TEMPLATES: Record<'fire' | 'fiveS', { name: string; items: string[] }[]> = {
  fire: [
    { name: 'มาตรฐานถังดับเพลิง', items: DEFAULT_AUDIT_CONFIG.fire.checklist },
    { name: 'ตรวจแบบย่อ', items: ['เข็มแรงดันอยู่ในช่องสีเขียว', 'สลักและซีลอยู่ครบ', 'ไม่มีสิ่งกีดขวาง'] },
    {
      name: 'ละเอียด (รวมป้ายและการติดตั้ง)',
      items: [
        ...DEFAULT_AUDIT_CONFIG.fire.checklist,
        'ติดตั้งสูงไม่เกิน 1.5 ม. จากพื้น',
        'มีป้ายบอกตำแหน่งมองเห็นได้ชัด',
        'มีบัตรบันทึกการตรวจติดที่ถัง'
      ]
    }
  ],
  fiveS: [
    { name: '5ส มาตรฐาน', items: DEFAULT_AUDIT_CONFIG.fiveS.categories },
    { name: '6ส (เพิ่มความปลอดภัย)', items: [...DEFAULT_AUDIT_CONFIG.fiveS.categories, 'ความปลอดภัย'] },
    { name: '3ส (เริ่มต้น)', items: ['สะสาง', 'สะดวก', 'สะอาด'] }
  ]
};

/** รอบตรวจสำเร็จรูป (วัน) */
export const INTERVAL_PRESETS = [
  { days: 7, label: 'ทุกสัปดาห์' },
  { days: 30, label: 'ทุกเดือน' },
  { days: 90, label: 'ทุก 3 เดือน' },
  { days: 180, label: 'ทุก 6 เดือน' },
  { days: 365, label: 'ทุกปี' }
];

/** เก็บประวัติการแจ้งล่าสุดไม่เกินเท่านี้ (ในเบราว์เซอร์) */
export const INCIDENT_LIMIT = 5000;

// KPI ตั้งต้น (ผู้ใช้แก้ชื่อ สูตร หน่วย เป้าหมาย หรือลบได้ทั้งหมด)
export const DEFAULT_KPIS: Kpi[] = [
  { id: 'kpi-mttr', name: 'MTTR', formula: 'repairTime / failures', unit: 'นาที', target: 60, better: 'lower' },
  { id: 'kpi-mtbf', name: 'MTBF', formula: 'runTime / failures', unit: 'นาที', target: 2000, better: 'higher' }
];

// สีประจำไลน์ที่สุ่มให้ตอนสร้างไลน์ใหม่
export const LINE_COLORS = ['#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5', '#0d9488', '#c026d3'];
