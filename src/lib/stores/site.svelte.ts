import { emptySite } from '../domain/sample';
import { MODELS } from '../domain/catalog';
import { DEFAULT_ANDON_STATES, DEFAULT_KPIS, DEFAULT_REASONS, INCIDENT_LIMIT, LINE_COLORS, SEVERITY_MAX, clampSeverity } from '../domain/defaults';
import type { KpiPeriod } from '../domain/kpi';
import { footprint, snapAxis } from '../domain/geometry';
import type { AndonState, Asset, AssetKind, AuditConfig, AuditModule, AuditRecord, Incident, Kpi, LineMode, Site } from '../domain/types';
import { auditSummary, AUDIT_STATUS_COLOR } from '../domain/audit';
import { DEFAULT_AUDIT_CONFIG } from '../domain/defaults';
import { loadLocal, saveLocal } from './persist';
import { checkFormula } from '../domain/formula';

export type Mode = 'view' | 'edit';
export type RibbonTab = 'home' | 'insert' | 'line' | 'andon' | 'kpi' | 'fiveS' | 'fire' | 'view';

/** ฟอร์มแก้ไข KPI: แก้ในฟอร์มก่อน กดบันทึกแล้วค่อยเปลี่ยนค่าจริง */
export interface KpiForm {
  id: string | null; // null = KPI ใหม่
  name: string;
  formula: string;
  unit: string;
  targetText: string; // ว่างได้ = ไม่ตั้งเป้า
  better: 'lower' | 'higher';
}



function loadRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem('iiimap.recent') ?? '[]');
    return Array.isArray(v) ? v.filter((id) => typeof id === 'string' && MODELS[id]).slice(0, 6) : [];
  } catch {
    return [];
  }
}


/** หน้าในศูนย์ตั้งค่า */
export type SettingsSection = 'site' | 'fiveS' | 'fire';

/** ค่าที่แก้ในศูนย์ตั้งค่า (เป็นฉบับร่าง จนกว่าจะกดบันทึก) */
export interface SettingsDraft {
  name: string;
  width: number;
  depth: number;
  audit: AuditConfig;
}

// state กลางของแอป (Svelte 5 runes)
export const app = $state({
  site: (loadLocal() ?? structuredClone(emptySite)) as Site,
  mode: 'edit' as Mode,
  selectedId: null as string | null,
  hoverId: null as string | null, // โมเดลที่เมาส์ชี้อยู่
  placing: null as AssetKind | null, // ชนิดที่กำลังจะวาง
  placeRot: 0,
  zoom: 1,
  showGrid: true,
  showAllNames: false, // แสดงชื่อเครื่องทุกตัวบนผัง
  tvMode: false, // โหมดจอ TV (แขวนหน้าไลน์)
  settings: null as SettingsSection | null, // ศูนย์ตั้งค่าที่เปิดอยู่ (หน้าไหน)
  frameLines: [] as string[], // ไลน์ที่แสดงกรอบ (และชื่อเครื่องในไลน์)
  recent: loadRecent(), // โมเดลที่ใช้ล่าสุด (สูงสุด 6)
  ribbonTab: 'insert' as RibbonTab,
  activeLineId: null as string | null, // ไลน์ที่กำลังดู (ไฮไลต์สมาชิกทั้งหมด)
  lineAddMode: null as string | null, // โหมด "คลิกบนผังเพื่อเพิ่มเข้าไลน์นี้"
  draftLineId: null as string | null, // ไลน์ที่เพิ่งสร้าง ยังไม่ได้กดบันทึก
  draftError: '',
  // KPIs
  kpiScope: 'site' as string, // 'site' = ทั้งโรงงาน หรือ id ของไลน์
  kpiPeriod: 'day' as KpiPeriod,
  kpiForm: null as KpiForm | null, // กล่องตั้งค่า KPI ที่เปิดอยู่ (แก้แล้วต้องกดบันทึก)
  kpiError: '',
  toast: '', // ข้อความแจ้งเตือนสั้นๆ ด้านล่างผัง
  auditForm: null as { module: AuditModule; targetId: string } | null, // หน้าต่างบันทึกการตรวจ
  focus: null as { x: number; z: number; seq: number } | null, // คำขอให้กล้องพาไปที่จุดนี้
  fiveSLineId: null as string | null, // ไลน์ที่เลือกดูในแท็บ 5ส
  saveState: 'saved' as 'saved' | 'saving' | 'error'
});

// ================= ไลน์ที่ยังไม่บันทึก =================
// ตอนกดสร้างไลน์ ไลน์ใหม่จะขึ้นในรายการทันที แต่ยังไม่นับว่าบันทึก
// - ระหว่างนี้แก้ชื่อ สี โหมด และเลือกเครื่องได้ตามปกติ
// - กดบันทึก = เข้าผังจริง (ย้อนกลับได้ 1 ขั้น)
// - กดยกเลิก = ไลน์หาย เครื่องกลับไปไลน์เดิม
let draftSnapshot: string | null = null; // สถานะก่อนเริ่มสร้าง (ใช้ลงประวัติตอนบันทึก)
let draftOrigin: Record<string, string | null> = {}; // ไลน์เดิมของเครื่องที่ถูกดึงเข้าไลน์ใหม่

/** ผังที่ไม่มีไลน์ที่ยังไม่บันทึก (ใช้ตอนบันทึกอัตโนมัติ) */
function withoutDraft(site: Site): Site {
  const id = app.draftLineId;
  if (!id) return site;
  return {
    ...site,
    lines: site.lines.filter((l) => l.id !== id),
    assets: site.assets.map((a) => (a.lineId === id ? { ...a, lineId: draftOrigin[a.id] ?? null } : a))
  };
}

const isDraft = (lineId: string | null) => !!lineId && lineId === app.draftLineId;

function clearDraft() {
  app.draftLineId = null;
  app.draftError = '';
  draftSnapshot = null;
  draftOrigin = {};
}

// ================= นาฬิกา (ใช้แสดงเวลาที่ผ่านไปของเรื่อง Andon) =================
// now = ทุกวินาที (เวลานับ Andon) / minute = ทุกนาที (สถานะการตรวจ ไม่ต้องคำนวณทุกวินาที)
export const clock = $state({ now: Date.now(), minute: Math.floor(Date.now() / 60000) * 60000 });
setInterval(() => {
  clock.now = Date.now();
  const m = Math.floor(clock.now / 60000) * 60000;
  if (m !== clock.minute) clock.minute = m;
}, 1000);

// ================= บันทึกอัตโนมัติ =================
// แก้ผังเมื่อไหร่ รอ 0.5 วินาทีหลังแก้ครั้งสุดท้ายแล้วค่อยบันทึก
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let lastSaved = JSON.stringify(app.site); // ตอนเปิดแอปยังไม่มีไลน์ร่าง

$effect.root(() => {
  $effect(() => {
    const json = JSON.stringify(withoutDraft(app.site)); // อ่านทุกค่าในผัง = ติดตามทุกการเปลี่ยนแปลง
    if (json === lastSaved) return;
    app.saveState = 'saving';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const ok = saveLocal(JSON.parse(json));
      if (ok) lastSaved = json;
      app.saveState = ok ? 'saved' : 'error';
    }, 500);
  });
});

// ================= ประวัติ (Undo / Redo) =================
// เก็บภาพรวมของผัง (ยกเว้นชื่อและขนาดผัง) เป็น JSON ก่อนทุกการแก้ไข
const HISTORY_LIMIT = 100;
export const history = $state({ past: [] as string[], future: [] as string[] });

const snapshot = () =>
  JSON.stringify({
    name: app.site.name,
    width: app.site.width,
    depth: app.site.depth,
    assets: app.site.assets,
    lines: app.site.lines,
    andonStates: app.site.andonStates,
    metrics: app.site.metrics,
    kpis: app.site.kpis,
    reasons: app.site.reasons,
    auditConfig: app.site.auditConfig
  });

function restore(json: string) {
  const s = JSON.parse(json);
  app.site.name = s.name;
  app.site.width = s.width;
  app.site.depth = s.depth;
  app.site.assets = s.assets;
  app.site.lines = s.lines;
  app.site.andonStates = s.andonStates;
  app.site.metrics = s.metrics;
  app.site.kpis = s.kpis;
  app.site.reasons = s.reasons;
  app.site.auditConfig = s.auditConfig;
  // ประวัติ Andon ไม่ถูกย้อนกลับ (เป็นบันทึกเหตุการณ์จริง) → ใส่สถานะของเรื่องที่ยังเปิดอยู่กลับให้เครื่อง
  for (const i of app.site.incidents) {
    if (i.resolvedAt !== null) continue;
    const a = app.site.assets.find((x) => x.id === i.assetId);
    if (a) a.status = i.stateId;
  }
  if (app.kpiForm?.id && !app.site.kpis.some((k) => k.id === app.kpiForm!.id)) app.kpiForm = null;
  if (!app.site.assets.some((a) => a.id === app.selectedId)) app.selectedId = null;
  if (!app.site.lines.some((l) => l.id === app.activeLineId)) app.activeLineId = null;
  if (!app.site.lines.some((l) => l.id === app.lineAddMode)) app.lineAddMode = null;
  if (app.draftLineId && !app.site.lines.some((l) => l.id === app.draftLineId)) clearDraft();
  app.frameLines = app.frameLines.filter((id) => app.site.lines.some((l) => l.id === id));
  app.hoverId = null;
}

/** จดสถานะปัจจุบันไว้ก่อนแก้ไข (เรียกก่อนทุก action ที่เปลี่ยนผัง) */
function checkpoint() {
  const snap = snapshot();
  if (history.past.at(-1) === snap) return;
  history.past.push(snap);
  if (history.past.length > HISTORY_LIMIT) history.past.shift();
  history.future = [];
}

let pendingEdit: string | null = null;
let pendingMove: string | null = null;
let modeBeforeTv: Mode = 'edit';
let tabBeforeTv: RibbonTab = 'view';

// ================= คลิปบอร์ด (Copy / Cut / Paste) =================
let clipboard: Asset | null = null;
let clipFromCut = false; // true = ของที่ตัดมา ยังไม่ได้วาง
export const clip = $state({ has: false });

// ================= ตัวช่วย =================
let seq = 0;
const newId = (p = 'a') => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** ชื่อถัดไปที่ยังไม่ซ้ำ เช่น CNC-03 */
function nextName(kind: AssetKind) {
  const prefix = MODELS[kind]?.prefix ?? 'X';
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const a of app.site.assets) {
    const m = re.exec(a.name);
    if (m) max = Math.max(max, +m[1]);
  }
  return `${prefix}-${String(max + 1).padStart(2, '0')}`;
}

function snapAsset(a: { x: number; z: number; w: number; d: number; rot: number }) {
  const [fw, fd] = footprint(a.w, a.d, a.rot);
  a.x = snapAxis(a.x, fw, app.site.width);
  a.z = snapAxis(a.z, fd, app.site.depth);
}

// ================= ห้ามทับ =================
type Box = { x: number; z: number; w: number; d: number; rot: number };

/** กินพื้นที่ของโมเดลอื่นหรือไม่ (ชิดขอบพอดีไม่นับว่าทับ) */
function overlapsOthers(b: Box, ignoreId?: string): boolean {
  const [bw, bd] = footprint(b.w, b.d, b.rot);
  const EPS = 1e-6;
  return app.site.assets.some((o) => {
    if (o.id === ignoreId) return false;
    const [ow, od] = footprint(o.w, o.d, o.rot);
    return Math.abs(b.x - o.x) < (bw + ow) / 2 - EPS && Math.abs(b.z - o.z) < (bd + od) / 2 - EPS;
  });
}

/**
 * หาตำแหน่งว่างให้โมเดล (ใช้ตอนวางจากคลิปบอร์ด)
 * ลองตามลำดับ: ตำแหน่งที่ต้องการ → ชิดขวา / ซ้าย / หน้า / หลัง ของชิ้นอ้างอิง → ขยายวงออกไปทีละ 1 ม.
 */
function findFreeSpot(b: Box, prefer: { x: number; z: number }[]): { x: number; z: number } | null {
  const tryAt = (x: number, z: number) => {
    const c = { ...b, x, z };
    snapAsset(c);
    return overlapsOthers(c) ? null : { x: c.x, z: c.z };
  };
  for (const p of prefer) {
    const ok = tryAt(p.x, p.z);
    if (ok) return ok;
  }
  const o = prefer[0] ?? { x: b.x, z: b.z };
  const maxR = Math.max(app.site.width, app.site.depth);
  for (let r = 1; r <= maxR; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (const dz of [-r, r]) {
        const ok = tryAt(o.x + dx, o.z + dz);
        if (ok) return ok;
      }
    }
    for (let dz = -r + 1; dz <= r - 1; dz++) {
      for (const dx of [-r, r]) {
        const ok = tryAt(o.x + dx, o.z + dz);
        if (ok) return ok;
      }
    }
  }
  return null;
}

/** ตำแหน่งชิดข้างของชิ้นเดิม: ขวา → ซ้าย → หน้า → หลัง */
function besideOf(a: Box) {
  const [fw, fd] = footprint(a.w, a.d, a.rot);
  return [
    { x: a.x + fw, z: a.z },
    { x: a.x - fw, z: a.z },
    { x: a.x, z: a.z + fd },
    { x: a.x, z: a.z - fd }
  ];
}

// ================= ขนาดผัง =================
export const SITE_MIN = 10;
export const SITE_MAX = 500; // เพดานทางเทคนิค (ไม่เกี่ยวกับราคา)

/** เครื่องที่จะหลุดขอบ ถ้าเปลี่ยนผังเป็นขนาด width × depth (ผังขยายจากกึ่งกลาง) */
export function siteSizeError(name: string, width: number, depth: number): string {
  if (!name.trim()) return 'กรุณาตั้งชื่อผัง';
  if (!Number.isInteger(width) || !Number.isInteger(depth)) return 'ขนาดผังต้องเป็นจำนวนเต็ม (เมตร)';
  if (width < SITE_MIN || depth < SITE_MIN || width > SITE_MAX || depth > SITE_MAX) return `ขนาดผังต้องอยู่ระหว่าง ${SITE_MIN}–${SITE_MAX} ม.`;
  const out = assetsOutside(width, depth);
  if (out.length)
    return `เครื่อง ${out.length} ตัวจะหลุดขอบผัง (${out.slice(0, 3).map((a) => a.name).join(', ')}${out.length > 3 ? ' …' : ''}) ย้ายเข้ามาก่อน หรือขยายผังให้ใหญ่ขึ้น`;
  return '';
}

export function assetsOutside(width: number, depth: number): Asset[] {
  const EPS = 1e-6;
  return app.site.assets.filter((a) => {
    const [fw, fd] = footprint(a.w, a.d, a.rot);
    return Math.abs(a.x) + fw / 2 > width / 2 + EPS || Math.abs(a.z) + fd / 2 > depth / 2 + EPS;
  });
}

// ================= แจ้งเตือนสั้นๆ (toast) =================
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function notify(text: string) {
  app.toast = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (app.toast = ''), 2500);
}

/** เรื่อง Andon ที่ยังเปิดอยู่ของเครื่องนี้ */
export function activeIncident(assetId: string): Incident | undefined {
  return app.site.incidents.find((i) => i.assetId === assetId && i.resolvedAt === null);
}

const find = (id: string) => app.site.assets.find((a) => a.id === id);
const findLine = (id: string) => app.site.lines.find((l) => l.id === id);

/** สถานะเริ่มต้นของเครื่องใหม่ = สถานะที่ระดับต่ำสุด (ไม่นับขาดการเชื่อมต่อ) */
function defaultStatus(): string {
  const states = app.site.andonStates.filter((s) => !s.system).sort((a, b) => a.severity - b.severity);
  return states[0]?.id ?? app.site.andonStates[0]?.id ?? 'running';
}

/** แทนที่ผังทั้งผัง (Import / ผังใหม่) แล้วล้างประวัติ เพราะย้อนข้ามผังไม่ได้ */
function replaceSite(site: Site) {
  app.site = site;
  app.selectedId = null;
  app.placing = null;
  app.activeLineId = null;
  app.lineAddMode = null;
  app.frameLines = [];
  app.kpiForm = null;
  app.kpiScope = 'site';
  app.auditForm = null;
  clearDraft();
  history.past = [];
  history.future = [];
  clipboard = null;
  clip.has = false;
}

export function kpiToForm(k: Kpi): KpiForm {
  return { id: k.id, name: k.name, formula: k.formula, unit: k.unit, targetText: k.target === null ? '' : String(k.target), better: k.better };
}

/** ฟอร์ม KPI มีการแก้ที่ยังไม่บันทึกหรือไม่ (KPI ใหม่ถือว่ามีเสมอ) */
export function kpiFormDirty(): boolean {
  const f = app.kpiForm;
  if (!f) return false;
  const k = f.id ? app.site.kpis.find((x) => x.id === f.id) : undefined;
  if (!k) return true;
  return JSON.stringify(kpiToForm(k)) !== JSON.stringify($state.snapshot(f));
}

/** ตรวจ KPI ก่อนบันทึก: คืนข้อความปัญหา หรือ '' ถ้าใช้ได้ */
export function kpiProblem(k: Kpi): string {
  const name = k.name.trim();
  if (!name) return 'กรุณาตั้งชื่อ KPI';
  if (app.site.kpis.some((x) => x.id !== k.id && x.name.trim() === name)) return `มี KPI ชื่อ "${name}" อยู่แล้ว`;
  return checkFormula(k.formula) ?? '';
}

// ================= สีสถานะบนผัง (Andon + การตรวจถังดับเพลิง) =================
export function statusColors(site: Site, now: number): Record<string, string> {
  const out = andonColors(site);
  for (const a of site.assets) {
    if (a.kind !== 'extinguisher') continue;
    out[a.id] = AUDIT_STATUS_COLOR[auditSummary(site, 'fire', a.id, now).status];
  }
  return out;
}

let focusSeq = 0;
/** ให้กล้องพาไปที่เครื่อง และเลือกเครื่องนั้น */
export function focusAsset(id: string) {
  const a = app.site.assets.find((x) => x.id === id);
  if (!a) return;
  app.selectedId = id;
  app.focus = { x: a.x, z: a.z, seq: ++focusSeq };
}
/** ให้กล้องพาไปที่กลางไลน์ */
export function focusLine(id: string) {
  const m = app.site.assets.filter((a) => a.lineId === id);
  if (!m.length) return;
  const xs = m.map((a) => a.x);
  const zs = m.map((a) => a.z);
  app.focus = { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2, seq: ++focusSeq };
}

// ================= สี Andon ที่แสดงจริงบนผัง =================
/**
 * คำนวณสีไฟ Andon ของแต่ละเครื่อง
 * - ByStation: สีตามสถานะของตัวเอง
 * - ByLine: ทุกเครื่องในไลน์ (ที่เปิด Andon) ใช้สีของสถานะที่ร้ายแรงที่สุดในไลน์
 *   เครื่องที่ขาดการเชื่อมต่อไม่นับ ยกเว้นทั้งไลน์ขาดการเชื่อมต่อหมด จึงแสดงเป็นขาดการเชื่อมต่อ
 */
export function andonColors(site: Site): Record<string, string> {
  const byId = new Map(site.andonStates.map((s) => [s.id, s]));
  const worst = new Map<string, AndonState>();
  for (const line of site.lines) {
    if (line.mode !== 'byLine') continue;
    let offline: AndonState | undefined;
    for (const a of site.assets) {
      if (a.lineId !== line.id || !a.andon) continue;
      const st = byId.get(a.status);
      if (!st) continue;
      if (st.system === 'offline') {
        offline = st;
        continue;
      }
      const cur = worst.get(line.id);
      if (!cur || st.severity > cur.severity) worst.set(line.id, st);
    }
    if (!worst.has(line.id) && offline) worst.set(line.id, offline);
  }
  const out: Record<string, string> = {};
  for (const a of site.assets) {
    if (!a.andon) continue;
    const line = a.lineId ? site.lines.find((l) => l.id === a.lineId) : undefined;
    const st = line?.mode === 'byLine' ? worst.get(line.id) : byId.get(a.status);
    out[a.id] = st?.color ?? '#94a3b8';
  }
  return out;
}

// ================= actions =================
export const actions = {
  setMode(mode: Mode) {
    app.mode = mode;
    app.placing = null;
    app.lineAddMode = null;
    // โหมดดูผัง: ไม่มีแท็บหน้าแรก / แทรก
    if (mode === 'view' && (app.ribbonTab === 'home' || app.ribbonTab === 'insert')) app.ribbonTab = 'view';
  },

  /** เข้าโหมดจอ TV: ดูผังอย่างเดียว ซ่อนเครื่องมือทั้งหมด */
  enterTv() {
    modeBeforeTv = app.mode; // จำโหมดเดิมไว้ ออกจาก TV แล้วกลับมาเหมือนเดิม
    tabBeforeTv = app.ribbonTab;
    app.mode = 'view';
    app.placing = null;
    app.lineAddMode = null;
    app.selectedId = null;
    app.tvMode = true;
    try {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } catch {
      /* เบราว์เซอร์ไม่อนุญาตเต็มจอ ก็ใช้โหมด TV ในหน้าต่างปกติ */
    }
  },

  exitTv() {
    app.tvMode = false;
    app.mode = modeBeforeTv;
    app.ribbonTab = tabBeforeTv;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  },

  setTab(tab: RibbonTab) {
    app.ribbonTab = tab;
    if (tab !== 'line') app.lineAddMode = null;
    // ออกจากแท็บ Line = ปิดกล่องตั้งค่าไลน์ (ยกเว้นไลน์ใหม่ที่ยังไม่บันทึก)
    if (tab !== 'line' && app.activeLineId !== app.draftLineId) app.activeLineId = null;
    if (tab !== 'insert' && !(tab === 'fire' && app.placing === 'extinguisher')) app.placing = null;
  },

  startPlacing(kind: AssetKind | null) {
    app.placing = app.placing === kind ? null : kind;
    app.selectedId = null;
    if (kind && app.placing === kind) {
      app.recent = [kind, ...app.recent.filter((k) => k !== kind)].slice(0, 6);
      try {
        localStorage.setItem('iiimap.recent', JSON.stringify(app.recent));
      } catch {
        /* ไม่บันทึกก็ไม่เป็นไร */
      }
    }
  },

  place(x: number, z: number, rot: number) {
    const kind = app.placing;
    const def = kind ? MODELS[kind] : undefined;
    if (!kind || !def) return;
    const asset: Asset = {
      id: newId(),
      name: nextName(kind),
      kind,
      lineId: null,
      x,
      z,
      w: def.w,
      d: def.d,
      rot,
      andon: false, // วางแล้วยังไม่มี Andon ผู้ใช้เปิดเองในแผงคุณสมบัติ
      status: defaultStatus()
    };
    snapAsset(asset);
    // กันไว้อีกชั้น (ปกติเงาสีแดงจะไม่ให้คลิกวางอยู่แล้ว)
    if (overlapsOthers(asset)) return;
    checkpoint();
    app.site.assets.push(asset);
    // ไม่เปิดแผงคุณสมบัติหลังวาง: จะเปิดเมื่อคลิกที่โมเดลเท่านั้น
  },

  /** เริ่มลากย้าย: จำสถานะไว้ ลงประวัติครั้งเดียวเมื่อย้ายได้จริง */
  moveStart() {
    pendingMove = snapshot();
  },

  /** ลากย้าย: ถ้าตำแหน่งใหม่ทับโมเดลอื่น โมเดลจะหยุดอยู่ตำแหน่งล่าสุดที่ว่าง */
  move(id: string, x: number, z: number) {
    const a = find(id);
    if (!a) return;
    if (overlapsOthers({ ...a, x, z }, id)) return;
    if (pendingMove !== null) {
      history.past.push(pendingMove);
      if (history.past.length > HISTORY_LIMIT) history.past.shift();
      history.future = [];
      pendingMove = null;
    }
    a.x = x;
    a.z = z;
  },

  rotate(id: string) {
    const a = find(id);
    if (!a) return;
    const next = { x: a.x, z: a.z, w: a.w, d: a.d, rot: (a.rot + 1) % 4 };
    snapAsset(next);
    if (overlapsOthers(next, id)) {
      notify(`หมุน ${a.name} ไม่ได้ เพราะจะทับโมเดลข้างๆ`);
      return;
    }
    checkpoint();
    Object.assign(a, next);
  },

  /** ขยาย/ลดทีละ 1 ม. ทั้งกว้างและลึก ไม่เล็กกว่า default และไม่ใหญ่เกินผัง */
  grow(id: string, step: 1 | -1) {
    const a = find(id);
    if (!a) return;
    const base = MODELS[a.kind];
    const w = a.w + step;
    const d = a.d + step;
    if (w < base.w || d < base.d) return;
    const [fw, fd] = footprint(w, d, a.rot);
    if (fw > app.site.width || fd > app.site.depth) return;
    const next = { x: a.x, z: a.z, w, d, rot: a.rot };
    snapAsset(next);
    if (step > 0 && overlapsOthers(next, id)) {
      notify(`ขยาย ${a.name} ไม่ได้ เพราะจะทับโมเดลข้างๆ`);
      return;
    }
    checkpoint();
    Object.assign(a, next);
  },

  /** เริ่มแก้ค่าในช่องกรอก (ชื่อ สูตร สี ...): จำสถานะไว้ก่อน */
  beginEdit() {
    pendingEdit = snapshot();
  },

  /** แก้เสร็จ: ถ้ามีอะไรเปลี่ยนจริง ค่อยลงประวัติ */
  commitEdit() {
    if (pendingEdit !== null && pendingEdit !== snapshot()) {
      history.past.push(pendingEdit);
      if (history.past.length > HISTORY_LIMIT) history.past.shift();
      history.future = [];
    }
    pendingEdit = null;
  },

  remove(id: string) {
    if (!find(id)) return;
    for (const i of app.site.incidents) {
      if (i.assetId === id && i.resolvedAt === null) {
        i.resolvedAt = Date.now();
        i.reason = 'เครื่องถูกลบออกจากผัง';
      }
    }
    checkpoint();
    app.site.assets = app.site.assets.filter((a) => a.id !== id);
    if (app.selectedId === id) app.selectedId = null;
  },

  // ---------- Andon บนเครื่อง ----------
  setAndon(id: string, on: boolean) {
    const a = find(id);
    if (!a || MODELS[a.kind]?.andon === 'none' || a.andon === on) return;
    checkpoint();
    a.andon = on;
  },

  setStatus(id: string, stateId: string) {
    const a = find(id);
    if (!a || a.status === stateId) return;
    checkpoint();
    a.status = stateId;
  },

  // ---------- แจ้ง Andon (หน้าไลน์) ----------
  // ไม่ลงประวัติย้อนกลับ (Ctrl+Z) เพราะเป็นเหตุการณ์จริงที่ต้องเก็บไว้คำนวณ KPI

  /** แจ้ง Andon: เปิดเรื่องใหม่ ไฟของเครื่องเปลี่ยนเป็นสีของสถานะที่แจ้ง */
  raiseAndon(assetId: string, stateId: string) {
    const a = find(assetId);
    const st = app.site.andonStates.find((x) => x.id === stateId);
    if (!a || !a.andon || !st || st.system) return;
    if (activeIncident(assetId)) return; // เครื่องหนึ่งมีเรื่องเปิดได้ทีละเรื่อง
    const inc: Incident = {
      id: newId('inc'),
      assetId,
      lineId: a.lineId,
      stateId,
      openedAt: Date.now(),
      ackAt: null,
      escalatedAt: null,
      resolvedAt: null,
      reason: null
    };
    app.site.incidents.push(inc);
    if (app.site.incidents.length > INCIDENT_LIMIT) app.site.incidents.splice(0, app.site.incidents.length - INCIDENT_LIMIT);
    a.status = stateId;
  },

  ackIncident(id: string) {
    const i = app.site.incidents.find((x) => x.id === id);
    if (i && i.ackAt === null && i.resolvedAt === null) i.ackAt = Date.now();
  },

  escalateIncident(id: string) {
    const i = app.site.incidents.find((x) => x.id === id);
    if (!i || i.escalatedAt !== null || i.resolvedAt !== null) return;
    const now = Date.now();
    if (i.ackAt === null) i.ackAt = now;
    i.escalatedAt = now;
  },

  /** ปิดเรื่อง (ต้องเลือกสาเหตุ) ไฟกลับเป็นสถานะปกติ */
  resolveIncident(id: string, reason: string) {
    const i = app.site.incidents.find((x) => x.id === id);
    if (!i || i.resolvedAt !== null || !reason.trim()) return;
    const now = Date.now();
    if (i.ackAt === null) i.ackAt = now;
    i.resolvedAt = now;
    i.reason = reason.trim();
    const a = find(i.assetId);
    if (a && a.status === i.stateId) a.status = defaultStatus();
  },

  /** ตั้ง/ยกเลิกสถานะขาดการเชื่อมต่อ (ไม่นับเป็นเรื่อง Andon) */
  setOffline(assetId: string, on: boolean) {
    const a = find(assetId);
    const off = app.site.andonStates.find((s) => s.system === 'offline');
    if (!a || !off || activeIncident(assetId)) return;
    a.status = on ? off.id : defaultStatus();
  },

  // ---------- การตรวจ (Audit) ----------
  // บันทึกการตรวจเป็นประวัติจริง ไม่ย้อนด้วย Ctrl+Z (ลบได้จากประวัติ พร้อมถามย้ำ)
  addAudit(rec: Omit<AuditRecord, 'id'>) {
    app.site.audits.push({ ...rec, id: newId('aud') });
  },

  deleteAudit(id: string) {
    app.site.audits = app.site.audits.filter((a) => a.id !== id);
  },

  openAuditForm(module: AuditModule, targetId: string) {
    app.auditForm = { module, targetId };
  },

  // ---------- สาเหตุ (reason codes) ----------
  addReason() {
    checkpoint();
    let n = 1;
    while (app.site.reasons.includes(`สาเหตุใหม่ ${n}`)) n++;
    app.site.reasons.push(`สาเหตุใหม่ ${n}`);
  },

  removeReason(index: number) {
    if (index < 0 || index >= app.site.reasons.length) return;
    checkpoint();
    app.site.reasons.splice(index, 1);
  },

  resetReasons() {
    checkpoint();
    app.site.reasons = [...DEFAULT_REASONS];
  },

  // ---------- Line ----------
  // ---------- กรอบไลน์ ----------
  toggleFrame(id: string) {
    app.frameLines = app.frameLines.includes(id) ? app.frameLines.filter((x) => x !== id) : [...app.frameLines, id];
  },

  setAllFrames(on: boolean) {
    app.frameLines = on ? app.site.lines.map((l) => l.id) : [];
  },

  // ---------- สร้างไลน์ใหม่ (ยังไม่บันทึก → บันทึก / ยกเลิก) ----------
  startDraft() {
    if (app.draftLineId) return;
    draftSnapshot = snapshot();
    draftOrigin = {};
    let n = app.site.lines.length + 1;
    while (app.site.lines.some((l) => l.name === `Line ${n}`)) n++;
    const id = newId('ln');
    app.site.lines.push({
      id,
      name: `Line ${n}`,
      mode: 'byLine',
      color: LINE_COLORS[app.site.lines.length % LINE_COLORS.length]
    });
    app.draftLineId = id;
    app.draftError = '';
    app.activeLineId = id;
    app.lineAddMode = id; // พร้อมคลิกเลือกเครื่องบนผังทันที
    app.ribbonTab = 'line';
  },

  /** บันทึกไลน์ใหม่: ตรวจชื่อ แล้วลงประวัติเป็นขั้นเดียว */
  saveDraft(): boolean {
    const line = app.draftLineId ? findLine(app.draftLineId) : undefined;
    if (!line) return false;
    const name = line.name.trim();
    if (!name) {
      app.draftError = 'กรุณาตั้งชื่อไลน์';
      return false;
    }
    if (app.site.lines.some((l) => l.id !== line.id && l.name.trim() === name)) {
      app.draftError = `มีไลน์ชื่อ "${name}" อยู่แล้ว`;
      return false;
    }
    line.name = name;
    if (draftSnapshot !== null) {
      history.past.push(draftSnapshot);
      if (history.past.length > HISTORY_LIMIT) history.past.shift();
      history.future = [];
    }
    app.lineAddMode = null;
    clearDraft();
    return true;
  },

  /** ยกเลิก: ไลน์หาย เครื่องที่ถูกดึงมากลับไลน์เดิม */
  cancelDraft() {
    const id = app.draftLineId;
    if (!id) return;
    for (const a of app.site.assets) {
      if (a.lineId !== id) continue;
      const orig = draftOrigin[a.id] ?? null;
      a.lineId = orig && findLine(orig) ? orig : null;
    }
    app.site.lines = app.site.lines.filter((l) => l.id !== id);
    if (app.activeLineId === id) app.activeLineId = null;
    if (app.lineAddMode === id) app.lineAddMode = null;
    app.frameLines = app.frameLines.filter((x) => x !== id);
    clearDraft();
  },

  setLineMode(id: string, mode: LineMode) {
    const l = findLine(id);
    if (!l || l.mode === mode) return;
    if (!isDraft(id)) checkpoint();
    l.mode = mode;
  },

  deleteLine(id: string) {
    if (!findLine(id)) return;
    if (isDraft(id)) return actions.cancelDraft();
    checkpoint();
    app.site.lines = app.site.lines.filter((l) => l.id !== id);
    for (const a of app.site.assets) if (a.lineId === id) a.lineId = null;
    app.frameLines = app.frameLines.filter((x) => x !== id);
    if (app.activeLineId === id) app.activeLineId = null;
    if (app.lineAddMode === id) app.lineAddMode = null;
  },

  /** เพิ่มเครื่องเข้าไลน์ (ถ้าอยู่ไลน์อื่นจะย้ายมา เพราะอยู่ได้ไลน์เดียว) */
  addToLine(assetId: string, lineId: string) {
    const a = find(assetId);
    if (!a || !findLine(lineId) || a.lineId === lineId) return;
    if (isDraft(lineId)) {
      // จำไลน์เดิมไว้ เผื่อกดยกเลิก
      if (!(a.id in draftOrigin)) draftOrigin[a.id] = a.lineId;
    } else {
      checkpoint();
    }
    a.lineId = lineId;
  },

  removeFromLine(assetId: string) {
    const a = find(assetId);
    if (!a || !a.lineId) return;
    if (isDraft(a.lineId)) {
      // เอาออกจากไลน์ที่ยังไม่บันทึก = กลับไลน์เดิม
      const orig = draftOrigin[a.id] ?? null;
      a.lineId = orig && findLine(orig) ? orig : null;
      delete draftOrigin[a.id];
      return;
    }
    checkpoint();
    a.lineId = null;
  },

  /** คลิกเครื่องบนผังในโหมดเพิ่มสมาชิก: ยังไม่อยู่ = เพิ่ม, อยู่แล้ว = เอาออก */
  toggleMember(assetId: string, lineId: string) {
    const a = find(assetId);
    if (!a) return;
    if (a.lineId === lineId) actions.removeFromLine(assetId);
    else actions.addToLine(assetId, lineId);
  },

  // ---------- สถานะ Andon (สีและความหมาย) ----------
  addAndonState() {
    checkpoint();
    const maxSev = Math.max(0, ...app.site.andonStates.filter((s) => !s.system).map((s) => s.severity));
    // แทรกก่อนสถานะของระบบ (ขาดการเชื่อมต่ออยู่ท้ายสุดเสมอ)
    const at = app.site.andonStates.findIndex((s) => s.system);
    const st = { id: newId('st'), name: 'สถานะใหม่', color: '#8b5cf6', severity: Math.min(SEVERITY_MAX, maxSev + 1) };
    if (at < 0) app.site.andonStates.push(st);
    else app.site.andonStates.splice(at, 0, st);
  },

  /** ตั้งระดับ (จำนวนเต็ม 0–9) สถานะของระบบตั้งไม่ได้ */
  setSeverity(id: string, value: number) {
    const st = app.site.andonStates.find((s) => s.id === id);
    if (!st || st.system) return;
    const v = clampSeverity(value);
    if (st.severity === v) return;
    checkpoint();
    st.severity = v;
  },

  deleteAndonState(id: string) {
    const target = app.site.andonStates.find((s) => s.id === id);
    if (!target || target.system) return; // สถานะของระบบลบไม่ได้
    if (app.site.andonStates.filter((s) => !s.system).length <= 1) return; // ต้องเหลืออย่างน้อย 1 สถานะ
    checkpoint();
    app.site.andonStates = app.site.andonStates.filter((s) => s.id !== id);
    const fallback = defaultStatus();
    for (const a of app.site.assets) if (a.status === id) a.status = fallback;
    app.site.metrics.failureStates = app.site.metrics.failureStates.filter((s) => s !== id);
  },

  resetAndonStates() {
    checkpoint();
    app.site.andonStates = structuredClone(DEFAULT_ANDON_STATES);
    const ids = new Set(app.site.andonStates.map((s) => s.id));
    const fallback = defaultStatus();
    for (const a of app.site.assets) if (!ids.has(a.status)) a.status = fallback;
    app.site.metrics.failureStates = app.site.metrics.failureStates.filter((s) => ids.has(s));
  },

  toggleFailureState(id: string) {
    checkpoint();
    const list = app.site.metrics.failureStates;
    app.site.metrics.failureStates = list.includes(id) ? list.filter((s) => s !== id) : [...list, id];
  },

  // ---------- KPIs ----------
  /** สร้าง KPI ใหม่: เปิดฟอร์มเปล่า ยังไม่บันทึกจนกว่าจะกดบันทึก */
  startKpiDraft() {
    let n = app.site.kpis.length + 1;
    while (app.site.kpis.some((k) => k.name === `KPI ${n}`)) n++;
    app.kpiForm = { id: null, name: `KPI ${n}`, formula: '', unit: '', targetText: '', better: 'lower' };
    app.kpiError = '';
    app.ribbonTab = 'kpi';
  },

  /** เปิดฟอร์มแก้ไข KPI ที่มีอยู่ (สำเนาค่า ยังไม่แก้ของจริง) */
  openKpi(id: string) {
    const k = app.site.kpis.find((x) => x.id === id);
    if (!k) return;
    app.kpiForm = kpiToForm(k);
    app.kpiError = '';
  },

  closeKpiForm() {
    app.kpiForm = null;
    app.kpiError = '';
  },

  /** บันทึกฟอร์ม: ตรวจก่อน แล้วลงผังเป็นขั้นเดียว (ย้อนกลับได้) */
  saveKpiForm(): boolean {
    const f = app.kpiForm;
    if (!f) return false;
    const target = f.targetText.trim() === '' ? null : Number(f.targetText.replace(/,/g, ''));
    if (target !== null && !Number.isFinite(target)) {
      app.kpiError = 'เป้าหมายต้องเป็นตัวเลข หรือเว้นว่างไว้';
      return false;
    }
    const data: Kpi = { id: f.id ?? newId('kpi'), name: f.name.trim(), formula: f.formula.trim(), unit: f.unit, target, better: f.better };
    const err = kpiProblem(data);
    if (err) {
      app.kpiError = err;
      return false;
    }
    checkpoint();
    const idx = app.site.kpis.findIndex((k) => k.id === data.id);
    if (idx >= 0) app.site.kpis[idx] = data;
    else app.site.kpis.push(data);
    app.kpiForm = null;
    app.kpiError = '';
    return true;
  },

  deleteKpi(id: string) {
    if (!app.site.kpis.some((k) => k.id === id)) return;
    checkpoint();
    app.site.kpis = app.site.kpis.filter((k) => k.id !== id);
    if (app.kpiForm?.id === id) app.kpiForm = null;
  },

  resetKpis() {
    checkpoint();
    app.site.kpis = structuredClone(DEFAULT_KPIS);
    app.kpiForm = null;
  },

  // ---------- ผัง ----------
  /** ค่าปัจจุบันสำหรับเริ่มแก้ในศูนย์ตั้งค่า */
  settingsDraft(): SettingsDraft {
    return {
      name: app.site.name,
      width: app.site.width,
      depth: app.site.depth,
      audit: $state.snapshot(app.site.auditConfig) as AuditConfig
    };
  },

  /** บันทึกศูนย์ตั้งค่า: คืนข้อความปัญหา หรือ '' ถ้าสำเร็จ (ย้อนกลับได้ 1 ขั้น) */
  saveSettings(d: SettingsDraft): string {
    const err = siteSizeError(d.name, d.width, d.depth);
    if (err) return err;
    const clean = (list: string[]) => [...new Set(list.map((x) => x.trim()).filter(Boolean))];
    // ร่างมาจาก $state (proxy) ใช้ structuredClone ตรงๆ ไม่ได้ ต้อง snapshot ก่อน
    const audit = $state.snapshot(d.audit) as AuditConfig;
    audit.fire.checklist = clean(audit.fire.checklist);
    audit.fiveS.categories = clean(audit.fiveS.categories);
    if (!audit.fire.checklist.length || !audit.fiveS.categories.length) return 'รายการหัวข้อต้องมีอย่างน้อย 1 ข้อ';
    for (const m of [audit.fire, audit.fiveS]) {
      m.intervalDays = Math.max(1, Math.round(m.intervalDays) || 1);
      m.dueSoonDays = Math.min(m.intervalDays - 1, Math.max(0, Math.round(m.dueSoonDays) || 0));
    }
    audit.fiveS.passScore = Math.min(100, Math.max(0, Math.round(audit.fiveS.passScore) || 0));
    audit.fiveS.goodScore = Math.min(100, Math.max(audit.fiveS.passScore, Math.round(audit.fiveS.goodScore) || 0));
    checkpoint();
    app.site.name = d.name.trim();
    app.site.width = d.width;
    app.site.depth = d.depth;
    app.site.auditConfig = audit;
    return '';
  },

  loadSite(site: Site) {
    replaceSite(site);
  },

  newSite() {
    replaceSite(structuredClone(emptySite));
  },

  // ---------- Undo / Redo ----------
  undo() {
    // ระหว่างสร้างไลน์ใหม่: ย้อนกลับ = ยกเลิกไลน์ที่ยังไม่บันทึก
    if (app.draftLineId) return actions.cancelDraft();
    const prev = history.past.pop();
    if (prev === undefined) return;
    history.future.push(snapshot());
    restore(prev);
  },

  redo() {
    if (app.draftLineId) return;
    const next = history.future.pop();
    if (next === undefined) return;
    history.past.push(snapshot());
    restore(next);
  },

  // ---------- Copy / Cut / Paste ----------
  copy() {
    const a = app.selectedId ? find(app.selectedId) : undefined;
    if (!a) return;
    clipboard = { ...$state.snapshot(a) };
    clipFromCut = false;
    clip.has = true;
  },

  cut() {
    if (!app.selectedId) return;
    actions.copy();
    clipFromCut = true;
    actions.remove(app.selectedId);
  },

  /**
   * วางของจากคลิปบอร์ด
   * - ตัดแล้ววาง: ครั้งแรกกลับไปที่ตำแหน่งเดิม (และกลับเข้าไลน์เดิม)
   * - คัดลอกแล้ววาง: วางชิดข้างตัวต้นฉบับ (ไม่เข้าไลน์ ผู้ใช้เลือกเองว่าจะใส่ไลน์ไหน)
   * - วางซ้ำ: วางชิดต่อจากชิ้นล่าสุดไปเรื่อยๆ
   */
  paste() {
    if (!clipboard) return;
    const src = clipboard;
    // ห้ามทับ: ถ้าจุดที่ควรวางไม่ว่าง หาจุดว่างที่ใกล้ที่สุด
    const prefer = clipFromCut ? [{ x: src.x, z: src.z }, ...besideOf(src)] : besideOf(src);
    const pos = findFreeSpot(src, prefer);
    if (!pos) {
      notify('ไม่มีพื้นที่ว่างพอสำหรับวาง');
      return;
    }
    checkpoint();
    const keepLine = clipFromCut && src.lineId && findLine(src.lineId) ? src.lineId : null;
    const asset: Asset = { ...src, id: newId(), name: nextName(src.kind), lineId: keepLine, ...pos };
    app.site.assets.push(asset);
    clipboard = { ...src, x: asset.x, z: asset.z };
    clipFromCut = false;
  }
};
