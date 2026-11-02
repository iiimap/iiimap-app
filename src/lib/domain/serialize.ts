// แปลงผังเป็นไฟล์ / อ่านผังจากไฟล์ (ใช้ทั้งบันทึกอัตโนมัติ และ Export / Import)
import type { AndonState, Asset, Line, MetricsConfig, Site } from './types';
import { DEFAULT_ANDON_STATES, DEFAULT_METRICS } from './defaults';
import { MODELS } from './catalog';

export const FILE_FORMAT = 'iiimap-site';
export const FILE_VERSION = 2;

export interface SiteFile {
  format: typeof FILE_FORMAT;
  version: number;
  savedAt: string;
  site: Site;
}

export function toFile(site: Site): SiteFile {
  return { format: FILE_FORMAT, version: FILE_VERSION, savedAt: new Date().toISOString(), site };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isColor = (v: unknown): v is string => isStr(v) && /^#[0-9a-fA-F]{6}$/.test(v);

function readStates(v: unknown): AndonState[] {
  if (!Array.isArray(v)) return structuredClone(DEFAULT_ANDON_STATES);
  const list = v.filter((s) => s && isStr(s.id) && isStr(s.name) && isColor(s.color) && isNum(s.severity));
  return list.length ? list : structuredClone(DEFAULT_ANDON_STATES);
}

function readLines(v: unknown): Line[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((l) => l && isStr(l.id) && isStr(l.name))
    .map((l) => ({
      id: l.id,
      name: l.name,
      mode: l.mode === 'byStation' ? 'byStation' : 'byLine',
      color: isColor(l.color) ? l.color : '#7c3aed'
    }));
}

function readMetrics(v: any): MetricsConfig {
  return {
    mttr: isStr(v?.mttr) ? v.mttr : DEFAULT_METRICS.mttr,
    mtbf: isStr(v?.mtbf) ? v.mtbf : DEFAULT_METRICS.mtbf,
    failureStates: Array.isArray(v?.failureStates) ? v.failureStates.filter(isStr) : [...DEFAULT_METRICS.failureStates]
  };
}

/** ตรวจและอ่านไฟล์ผัง (รองรับไฟล์เวอร์ชันเก่า) คืน null ถ้าไฟล์ไม่ถูกต้อง */
export function fromFile(data: unknown): Site | null {
  const f = data as SiteFile;
  if (!f || f.format !== FILE_FORMAT || !isNum(f.version) || f.version > FILE_VERSION) return null;
  const s = f.site as any;
  if (!s || !isStr(s.name) || !isNum(s.width) || !isNum(s.depth) || !Array.isArray(s.assets)) return null;

  const andonStates = readStates(s.andonStates);
  const lines = readLines(s.lines);
  const stateIds = new Set(andonStates.map((x) => x.id));
  const lineIds = new Set(lines.map((x) => x.id));
  const fallbackState = andonStates.find((x) => x.id === 'idle')?.id ?? andonStates[0].id;

  const assets: Asset[] = s.assets
    .filter((a: any) => a && isStr(a.id) && isStr(a.name) && isStr(a.kind) && isNum(a.x) && isNum(a.z) && isNum(a.w) && isNum(a.d) && isNum(a.rot))
    .map((a: any) => {
      const cap = MODELS[a.kind]?.andon ?? 'none';
      return {
        id: a.id,
        name: a.name,
        kind: a.kind,
        lineId: isStr(a.lineId) && lineIds.has(a.lineId) ? a.lineId : null,
        x: a.x, z: a.z, w: a.w, d: a.d, rot: a.rot,
        // ไฟล์เก่าไม่มีช่อง andon: ใช้ค่าเริ่มต้นตามประเภท
        andon: cap === 'none' ? false : typeof a.andon === 'boolean' ? a.andon : cap === 'default-on',
        status: isStr(a.status) && stateIds.has(a.status) ? a.status : fallbackState
      };
    });

  return {
    id: isStr(s.id) ? s.id : 'site-1',
    tenantId: isStr(s.tenantId) ? s.tenantId : 'demo',
    name: s.name,
    width: s.width,
    depth: s.depth,
    lines,
    andonStates,
    metrics: readMetrics(s.metrics),
    assets
  };
}
