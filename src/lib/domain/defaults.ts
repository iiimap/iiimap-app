import type { AndonState, MetricsConfig } from './types';

// สถานะ Andon ตั้งต้น (ผู้ใช้แก้ชื่อ สี และระดับความร้ายแรงได้ทั้งหมด)
export const DEFAULT_ANDON_STATES: AndonState[] = [
  { id: 'running', name: 'ทำงานปกติ', color: '#16a34a', severity: 0 },
  { id: 'idle', name: 'รอ / ว่าง', color: '#f59e0b', severity: 1 },
  { id: 'material', name: 'เรียกวัตถุดิบ', color: '#2563eb', severity: 2 },
  { id: 'alarm', name: 'เครื่องเสีย', color: '#dc2626', severity: 3 },
  { id: 'offline', name: 'ออฟไลน์', color: '#94a3b8', severity: -1 }
];

export const DEFAULT_METRICS: MetricsConfig = {
  mttr: 'repairTime / failures',
  mtbf: 'runTime / failures',
  failureStates: ['alarm']
};

// สีประจำไลน์ที่สุ่มให้ตอนสร้างไลน์ใหม่
export const LINE_COLORS = ['#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5', '#0d9488', '#c026d3'];
