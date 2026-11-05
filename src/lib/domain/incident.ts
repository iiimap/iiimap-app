// ตัวช่วยเรื่อง Andon (เหตุการณ์แจ้งปัญหา)
import type { Incident, IncidentStage } from './types';

export function stageOf(i: Incident): IncidentStage {
  if (i.resolvedAt !== null) return 'resolved';
  if (i.escalatedAt !== null) return 'escalated';
  if (i.ackAt !== null) return 'ack';
  return 'open';
}

export const STAGE_LABEL: Record<IncidentStage, string> = {
  open: 'รอรับเรื่อง',
  ack: 'รับเรื่องแล้ว',
  escalated: 'ส่งต่อแล้ว',
  resolved: 'ปิดเรื่องแล้ว'
};

/** เวลาที่ผ่านไป แบบ ชม.:นาที:วินาที หรือ นาที:วินาที */
export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`;
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
