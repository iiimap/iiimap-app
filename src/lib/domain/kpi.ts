// คำนวณค่า KPI จากตัวแปรของระบบ Andon
// ตอนนี้ยังไม่มีประวัติเหตุการณ์จริง (ต้องมี backend) จึงใช้ "ข้อมูลตัวอย่าง" ที่สร้างจาก id ของเครื่อง
// ค่าเดิมทุกครั้งที่เปิด (ไม่สุ่มใหม่) เพื่อให้ทดลองสูตรและหน้าจอได้
import type { Kpi, Site } from './types';
import { evalFormula } from './formula';

/** หน่วยที่เลือกได้ใน KPI */
export const KPI_UNITS: { value: string; label: string }[] = [
  { value: 'ชม.', label: 'ชั่วโมง (ชม.)' },
  { value: 'นาที', label: 'นาที' },
  { value: 'วินาที', label: 'วินาที' },
  { value: '%', label: 'เปอร์เซ็นต์ (%)' },
  { value: 'ครั้ง', label: 'ครั้ง' },
  { value: '', label: 'ไม่มีหน่วย' }
];

export const BETTER_LABEL = { lower: 'ยิ่งต่ำยิ่งดี', higher: 'ยิ่งสูงยิ่งดี' } as const;

export type KpiPeriod = 'day' | 'week' | 'month';
export const PERIODS: { id: KpiPeriod; label: string; days: number }[] = [
  { id: 'day', label: 'วันนี้', days: 1 },
  { id: 'week', label: '7 วัน', days: 7 },
  { id: 'month', label: '30 วัน', days: 30 }
];

/** ขอบเขตของ KPI: 'site' = ทั้งโรงงาน หรือ id ของไลน์ */
export type KpiScope = string;

function rand(seed: string, salt: number) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

/** ค่าตัวแปรตัวอย่างของขอบเขตและช่วงเวลาที่เลือก (รวมเฉพาะเครื่องที่เปิด Andon) */
export function demoVariables(site: Site, scope: KpiScope, period: KpiPeriod): { values: Record<string, number>; machines: number } {
  const days = PERIODS.find((p) => p.id === period)?.days ?? 1;
  const assets = site.assets.filter((a) => a.andon && (scope === 'site' || a.lineId === scope));
  const v = { repairTime: 0, failures: 0, runTime: 0, plannedTime: 0, downTime: 0, responseTime: 0 };
  for (const a of assets) {
    const seed = a.id + period; // แต่ละช่วงเวลาได้ค่าต่างกัน
    const planned = 1200 * days; // 20 ชม. ต่อวัน
    const failures = Math.round(rand(seed, 1) * 1.6 * days);
    const repair = failures * (20 + rand(seed, 2) * 50);
    const otherStops = rand(seed, 3) * 45 * days;
    const down = Math.min(planned, repair + otherStops);
    v.plannedTime += planned;
    v.failures += failures;
    v.repairTime += repair;
    v.downTime += down;
    v.runTime += planned - down;
    v.responseTime += failures * (3 + rand(seed, 4) * 10);
  }
  return { values: v, machines: assets.length };
}

export type KpiState = 'good' | 'bad' | 'none';

/** เทียบกับเป้าหมาย: ค่าต่ำดี หรือค่าสูงดี */
export function kpiState(k: Kpi, value: number): KpiState {
  if (k.target === null || !Number.isFinite(value)) return 'none';
  return (k.better === 'lower' ? value <= k.target : value >= k.target) ? 'good' : 'bad';
}

export function kpiValue(k: Kpi, values: Record<string, number>): number {
  return evalFormula(k.formula, values);
}

export const fmtNum = (v: number) => (Number.isFinite(v) ? v.toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '—');

/** ค่า KPI ทุกตัวของขอบเขตและช่วงเวลาที่เลือก */
export function computeKpis(site: Site, scope: KpiScope, period: KpiPeriod) {
  const { values, machines } = demoVariables(site, scope, period);
  return {
    machines,
    values,
    items: site.kpis.map((k) => {
      const value = kpiValue(k, values);
      return { kpi: k, value, state: kpiState(k, value) };
    })
  };
}
