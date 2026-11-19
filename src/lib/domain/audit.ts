// ระบบ Audit กลาง: นับจำนวนครั้ง, ตรวจล่าสุด, ครั้งถัดไป และสถานะ (ใช้ทั้งถังดับเพลิงและ 5ส)
import type { AuditModule, AuditRecord, Site } from './types';

export type AuditStatus = 'never' | 'ok' | 'soon' | 'overdue' | 'failed';

export const AUDIT_STATUS_LABEL: Record<AuditStatus, string> = {
  never: 'ยังไม่เคยตรวจ',
  ok: 'ปกติ',
  soon: 'ใกล้ถึงกำหนด',
  overdue: 'เลยกำหนด',
  failed: 'ตรวจไม่ผ่าน'
};

export const AUDIT_STATUS_COLOR: Record<AuditStatus, string> = {
  never: '#94a3b8',
  ok: '#16a34a',
  soon: '#f59e0b',
  overdue: '#dc2626',
  failed: '#dc2626'
};

const DAY = 86400000;

export interface AuditSummary {
  count: number;
  last: AuditRecord | null;
  nextDue: number | null; // วันที่ต้องตรวจครั้งถัดไป
  daysLeft: number | null; // เหลืออีกกี่วัน (ติดลบ = เลยมาแล้ว)
  status: AuditStatus;
}

/** สรุปการตรวจของเป้าหมาย 1 ตัว (ถังดับเพลิง 1 ถัง หรือไลน์ 1 ไลน์) */
export function auditSummary(site: Site, module: AuditModule, targetId: string, now: number): AuditSummary {
  const cfg = site.auditConfig[module];
  const list = site.audits.filter((a) => a.module === module && a.targetId === targetId);
  if (!list.length) return { count: 0, last: null, nextDue: null, daysLeft: null, status: 'never' };
  const last = list.reduce((a, b) => (b.at > a.at ? b : a));
  const nextDue = last.at + cfg.intervalDays * DAY;
  const daysLeft = Math.ceil((startOfDay(nextDue) - startOfDay(now)) / DAY);
  let status: AuditStatus = 'ok';
  if (daysLeft < 0) status = 'overdue';
  else if (!last.passed) status = 'failed';
  else if (daysLeft <= cfg.dueSoonDays) status = 'soon';
  return { count: list.length, last, nextDue, daysLeft, status };
}

export function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** ประวัติการตรวจของเป้าหมาย (ใหม่สุดก่อน) */
export function auditHistory(site: Site, module: AuditModule, targetId: string): AuditRecord[] {
  return site.audits.filter((a) => a.module === module && a.targetId === targetId).sort((a, b) => b.at - a.at);
}

/** คะแนน 5ส เป็น % จากคะแนน 0–5 ต่อหัวข้อ */
export function fiveSPercent(scores: Record<string, number>, categories: string[]): number {
  if (!categories.length) return 0;
  const sum = categories.reduce((s, c) => s + (scores[c] ?? 0), 0);
  return Math.round((sum / (categories.length * 5)) * 1000) / 10;
}

/** สีตามคะแนน 5ส: ≥ 80 เขียว, ≥ เกณฑ์ผ่าน เหลือง, ต่ำกว่าเกณฑ์ แดง */
export function fiveSColor(percent: number | null, passScore: number): string {
  if (percent === null) return '#94a3b8';
  if (percent >= Math.max(80, passScore)) return '#16a34a';
  if (percent >= passScore) return '#f59e0b';
  return '#dc2626';
}

export function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDaysLeft(days: number | null) {
  if (days === null) return '-';
  if (days === 0) return 'วันนี้';
  return days > 0 ? `อีก ${days} วัน` : `เลยมา ${-days} วัน`;
}
