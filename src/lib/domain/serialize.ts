// แปลงผังเป็นไฟล์ / อ่านผังจากไฟล์ (ใช้ทั้งบันทึกอัตโนมัติ และ Export / Import)
import type { AndonState, Asset, Incident, Kpi, Line, MetricsConfig, Site } from './types';
import { DEFAULT_ANDON_STATES, DEFAULT_KPIS, DEFAULT_METRICS, DEFAULT_REASONS, INCIDENT_LIMIT, OFFLINE_STATE, clampSeverity } from './defaults';
import { MODELS } from './catalog';

export const FILE_FORMAT = 'iiimap-site';
export const FILE_VERSION = 4;

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
  const list: AndonState[] = v
    .filter((s) => s && isStr(s.id) && isStr(s.name) && isColor(s.color) && isNum(s.severity))
    .map((s) =>
      s.id === OFFLINE_STATE.id || s.system === 'offline'
        ? { ...OFFLINE_STATE, id: s.id, name: s.name, color: s.color }
        : { id: s.id, name: s.name, color: s.color, severity: clampSeverity(s.severity) }
    );
  if (!list.some((s) => s.system === 'offline')) list.push({ ...OFFLINE_STATE }); // ต้องมีสถานะขาดการเชื่อมต่อเสมอ
  return list.some((s) => !s.system) ? list : structuredClone(DEFAULT_ANDON_STATES);
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
    failureStates: Array.isArray(v?.failureStates) ? v.failureStates.filter(isStr) : [...DEFAULT_METRICS.failureStates]
  };
}

/** อ่าน KPI (ไฟล์เวอร์ชัน 2 เก็บสูตร MTTR/MTBF ไว้ใน metrics: ย้ายมาเป็น KPI ให้) */
function readKpis(v: unknown, oldMetrics: any): Kpi[] {
  if (Array.isArray(v)) {
    return v
      .filter((k) => k && isStr(k.id) && isStr(k.name) && isStr(k.formula))
      .map((k) => ({
        id: k.id,
        name: k.name,
        formula: k.formula,
        unit: isStr(k.unit) ? k.unit : '',
        target: isNum(k.target) ? k.target : null,
        better: k.better === 'higher' ? 'higher' : 'lower'
      }));
  }
  const kpis = structuredClone(DEFAULT_KPIS);
  if (isStr(oldMetrics?.mttr)) kpis[0].formula = oldMetrics.mttr;
  if (isStr(oldMetrics?.mtbf)) kpis[1].formula = oldMetrics.mtbf;
  return kpis;
}

const numOrNull = (v: unknown) => (isNum(v) ? v : null);

function readIncidents(v: unknown): Incident[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((i) => i && isStr(i.id) && isStr(i.assetId) && isStr(i.stateId) && isNum(i.openedAt))
    .map((i) => ({
      id: i.id,
      assetId: i.assetId,
      lineId: isStr(i.lineId) ? i.lineId : null,
      stateId: i.stateId,
      openedAt: i.openedAt,
      ackAt: numOrNull(i.ackAt),
      escalatedAt: numOrNull(i.escalatedAt),
      resolvedAt: numOrNull(i.resolvedAt),
      reason: isStr(i.reason) ? i.reason : null
    }))
    .slice(-INCIDENT_LIMIT);
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
        andon: cap === 'none' ? false : a.andon === true,
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
    kpis: readKpis(s.kpis, s.metrics),
    reasons: Array.isArray(s.reasons) ? s.reasons.filter(isStr) : [...DEFAULT_REASONS],
    incidents: readIncidents(s.incidents),
    assets
  };
}
