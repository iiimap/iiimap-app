// หมวดของโมเดล (เรียงตามลำดับที่แสดงในแกลเลอรี)
export const CATEGORIES = [
  { id: 'machine', label: 'เครื่องจักร' },
  { id: 'conveyor', label: 'ลำเลียง' },
  { id: 'station', label: 'สถานีงาน' },
  { id: 'storage', label: 'คลังและโลจิสติกส์' },
  { id: 'decoration', label: 'ตกแต่ง' }
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

/**
 * ความสามารถมี Andon กำหนดตามประเภทของ object (ไม่ใช่รายโมเดล)
 * - optional: วางแล้วยังไม่มี Andon ผู้ใช้เลือกเปิดเองได้
 * - none:     ไม่มีให้เลือก (ของตกแต่ง พาเลท ชั้นวาง)
 */
export type AndonCapability = 'none' | 'optional';

export interface ModelDef {
  id: string;
  label: string;
  category: CategoryId;
  prefix: string; // ใช้ตั้งชื่ออัตโนมัติ เช่น CNC-01
  andon: AndonCapability;
  w: number; // ขนาด default (เมตร)
  d: number;
  h: number;
}

// โมเดลทั้งหมดที่วางได้ (หน้าตาอยู่ใน map-engine/models.ts)
export const MODELS: Record<string, ModelDef> = {
  cnc: { id: 'cnc', label: 'เครื่อง CNC', category: 'machine', prefix: 'CNC', andon: 'optional', w: 3, d: 3, h: 2.6 },
  injection: { id: 'injection', label: 'เครื่องฉีดพลาสติก', category: 'machine', prefix: 'INJ', andon: 'optional', w: 5, d: 2, h: 2.6 },
  press: { id: 'press', label: 'เครื่องปั๊ม', category: 'machine', prefix: 'PR', andon: 'optional', w: 3, d: 3, h: 3.6 },
  robot: { id: 'robot', label: 'แขนกลหุ่นยนต์', category: 'machine', prefix: 'RB', andon: 'optional', w: 2, d: 2, h: 2.4 },

  conveyor: { id: 'conveyor', label: 'สายพาน', category: 'conveyor', prefix: 'CV', andon: 'optional', w: 6, d: 1, h: 0.9 },
  agv: { id: 'agv', label: 'รถ AGV', category: 'conveyor', prefix: 'AGV', andon: 'optional', w: 2, d: 1, h: 0.6 },

  assembly: { id: 'assembly', label: 'โต๊ะประกอบ', category: 'station', prefix: 'AS', andon: 'optional', w: 2, d: 1, h: 1.9 },
  qc: { id: 'qc', label: 'จุดตรวจ QC', category: 'station', prefix: 'QC', andon: 'optional', w: 2, d: 1, h: 1.5 },

  rack: { id: 'rack', label: 'ชั้นวางพาเลท', category: 'storage', prefix: 'RK', andon: 'none', w: 4, d: 1, h: 3 },
  pallet: { id: 'pallet', label: 'พาเลทสินค้า', category: 'storage', prefix: 'PL', andon: 'none', w: 1, d: 1, h: 1.1 },
  dock: { id: 'dock', label: 'Dock ขนถ่าย', category: 'storage', prefix: 'D', andon: 'optional', w: 4, d: 4, h: 3.4 },

  plant: { id: 'plant', label: 'กระถางต้นไม้', category: 'decoration', prefix: 'PT', andon: 'none', w: 1, d: 1, h: 1.6 },
  barrier: { id: 'barrier', label: 'แผงกั้นทางเดิน', category: 'decoration', prefix: 'BR', andon: 'none', w: 3, d: 1, h: 1 }
};

export const MODE_LABEL = { byLine: 'ByLine (สีเชื่อมทั้งไลน์)', byStation: 'ByStation (แยกแต่ละสถานี)' } as const;
