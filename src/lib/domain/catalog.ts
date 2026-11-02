import type { AssetStatus } from './types';

// หมวดของโมเดล (เรียงตามลำดับที่แสดงในแผงซ้าย)
export const CATEGORIES = [
  { id: 'machine', label: 'เครื่องจักร' },
  { id: 'conveyor', label: 'ลำเลียง' },
  { id: 'station', label: 'สถานีงาน' },
  { id: 'storage', label: 'คลังและโลจิสติกส์' }
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

export interface ModelDef {
  id: string;
  label: string;
  category: CategoryId;
  prefix: string; // ใช้ตั้งชื่ออัตโนมัติ เช่น CNC-01
  w: number; // ขนาด default (เมตร)
  d: number;
  h: number;
}

// โมเดลทั้งหมดที่วางได้ (หน้าตาโมเดลอยู่ใน map-engine/models.ts)
export const MODELS: Record<string, ModelDef> = {
  cnc: { id: 'cnc', label: 'เครื่อง CNC', category: 'machine', prefix: 'CNC', w: 3, d: 3, h: 2.6 },
  injection: { id: 'injection', label: 'เครื่องฉีดพลาสติก', category: 'machine', prefix: 'INJ', w: 5, d: 2, h: 2.6 },
  press: { id: 'press', label: 'เครื่องปั๊ม', category: 'machine', prefix: 'PR', w: 3, d: 3, h: 3.6 },
  robot: { id: 'robot', label: 'แขนกลหุ่นยนต์', category: 'machine', prefix: 'RB', w: 2, d: 2, h: 2.4 },

  conveyor: { id: 'conveyor', label: 'สายพาน', category: 'conveyor', prefix: 'CV', w: 6, d: 1, h: 0.9 },
  agv: { id: 'agv', label: 'รถ AGV', category: 'conveyor', prefix: 'AGV', w: 2, d: 1, h: 0.6 },

  assembly: { id: 'assembly', label: 'โต๊ะประกอบ', category: 'station', prefix: 'AS', w: 2, d: 1, h: 1.9 },
  qc: { id: 'qc', label: 'จุดตรวจ QC', category: 'station', prefix: 'QC', w: 2, d: 1, h: 1.5 },

  rack: { id: 'rack', label: 'ชั้นวางพาเลท', category: 'storage', prefix: 'RK', w: 4, d: 1, h: 3 },
  pallet: { id: 'pallet', label: 'พาเลทสินค้า', category: 'storage', prefix: 'PL', w: 1, d: 1, h: 1.1 },
  dock: { id: 'dock', label: 'Dock ขนถ่าย', category: 'storage', prefix: 'D', w: 4, d: 4, h: 3.4 }
};

export const STATUS_LABEL: Record<AssetStatus, string> = {
  running: 'ทำงาน',
  idle: 'รอ',
  alarm: 'Alarm',
  offline: 'ออฟไลน์'
};
