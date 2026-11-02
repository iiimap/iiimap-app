import { emptySite } from '../domain/sample';
import { MODELS } from '../domain/catalog';
import { DEFAULT_ANDON_STATES, DEFAULT_METRICS, LINE_COLORS, SEVERITY_MAX, clampSeverity } from '../domain/defaults';
import { footprint, snapAxis } from '../domain/geometry';
import type { AndonState, Asset, AssetKind, LineMode, Site } from '../domain/types';
import { loadLocal, saveLocal } from './persist';

export type Mode = 'view' | 'edit';
export type RibbonTab = 'home' | 'insert' | 'line' | 'andon' | 'view';

/** ไลน์ที่กำลังสร้าง: ยังไม่เข้าผังจนกว่าจะกดบันทึก */
export interface LineDraft {
  name: string;
  color: string;
  mode: LineMode;
  members: string[]; // id ของเครื่อง
  error: string;
}

/** ใช้กับ lineAddMode เมื่อกำลังเลือกเครื่องให้ไลน์ที่ยังไม่บันทึก */
export const DRAFT = '__draft__';

function loadRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem('iiimap.recent') ?? '[]');
    return Array.isArray(v) ? v.filter((id) => typeof id === 'string' && MODELS[id]).slice(0, 6) : [];
  } catch {
    return [];
  }
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
  showLineFrames: false, // แสดงกรอบทุกไลน์
  recent: loadRecent(), // โมเดลที่ใช้ล่าสุด (สูงสุด 6)
  ribbonTab: 'insert' as RibbonTab,
  activeLineId: null as string | null, // ไลน์ที่กำลังดู (ไฮไลต์สมาชิกทั้งหมด)
  lineAddMode: null as string | null, // โหมด "คลิกบนผังเพื่อเพิ่มเข้าไลน์นี้" (DRAFT = ไลน์ที่กำลังสร้าง)
  draft: null as LineDraft | null, // ไลน์ที่กำลังสร้าง (ยังไม่บันทึก)
  saveState: 'saved' as 'saved' | 'saving' | 'error'
});

// ================= บันทึกอัตโนมัติ =================
// แก้ผังเมื่อไหร่ รอ 0.5 วินาทีหลังแก้ครั้งสุดท้ายแล้วค่อยบันทึก
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let lastSaved = JSON.stringify(app.site);

$effect.root(() => {
  $effect(() => {
    const json = JSON.stringify(app.site); // อ่านทุกค่าในผัง = ติดตามทุกการเปลี่ยนแปลง
    if (json === lastSaved) return;
    app.saveState = 'saving';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const ok = saveLocal(app.site);
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
    assets: app.site.assets,
    lines: app.site.lines,
    andonStates: app.site.andonStates,
    metrics: app.site.metrics
  });

function restore(json: string) {
  const s = JSON.parse(json);
  app.site.assets = s.assets;
  app.site.lines = s.lines;
  app.site.andonStates = s.andonStates;
  app.site.metrics = s.metrics;
  if (!app.site.assets.some((a) => a.id === app.selectedId)) app.selectedId = null;
  if (!app.site.lines.some((l) => l.id === app.activeLineId)) app.activeLineId = null;
  if (app.lineAddMode !== DRAFT && !app.site.lines.some((l) => l.id === app.lineAddMode)) app.lineAddMode = null;
  if (app.draft) app.draft.members = app.draft.members.filter((id) => app.site.assets.some((a) => a.id === id));
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

/** ตำแหน่งชิดข้างของชิ้นเดิม: ลองขวา → ซ้าย → หน้า → หลัง เอาด้านแรกที่ไม่หลุดขอบผัง */
function besideOf(a: Asset) {
  const [fw, fd] = footprint(a.w, a.d, a.rot);
  const hw = app.site.width / 2 - fw / 2;
  const hd = app.site.depth / 2 - fd / 2;
  const options = [
    { x: a.x + fw, z: a.z },
    { x: a.x - fw, z: a.z },
    { x: a.x, z: a.z + fd },
    { x: a.x, z: a.z - fd }
  ];
  return options.find((p) => Math.abs(p.x) <= hw && Math.abs(p.z) <= hd) ?? options[0];
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
  app.draft = null;
  history.past = [];
  history.future = [];
  clipboard = null;
  clip.has = false;
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

  setTab(tab: RibbonTab) {
    app.ribbonTab = tab;
    if (tab !== 'line') app.lineAddMode = null;
    if (tab !== 'insert') app.placing = null;
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
    checkpoint();
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
      andon: def.andon === 'default-on', // ค่าเริ่มต้นตามประเภท
      status: defaultStatus()
    };
    snapAsset(asset);
    app.site.assets.push(asset);
    // ไม่เปิดแผงคุณสมบัติหลังวาง: จะเปิดเมื่อคลิกที่โมเดลเท่านั้น
  },

  /** เริ่มลากย้าย: จดประวัติครั้งเดียวต่อการลาก 1 ครั้ง */
  moveStart() {
    checkpoint();
  },

  move(id: string, x: number, z: number) {
    const a = find(id);
    if (a) {
      a.x = x;
      a.z = z;
    }
  },

  rotate(id: string) {
    const a = find(id);
    if (!a) return;
    checkpoint();
    a.rot = (a.rot + 1) % 4;
    snapAsset(a);
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
    checkpoint();
    a.w = w;
    a.d = d;
    snapAsset(a);
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

  // ---------- Line ----------
  // ---------- สร้างไลน์ใหม่ (ร่าง → บันทึก) ----------
  startDraft() {
    let n = app.site.lines.length + 1;
    while (app.site.lines.some((l) => l.name === `Line ${n}`)) n++;
    app.draft = {
      name: `Line ${n}`,
      color: LINE_COLORS[app.site.lines.length % LINE_COLORS.length],
      mode: 'byLine',
      members: [],
      error: ''
    };
    app.activeLineId = null;
    app.lineAddMode = null;
    app.ribbonTab = 'line';
  },

  draftToggle(assetId: string) {
    const d = app.draft;
    if (!d) return;
    d.members = d.members.includes(assetId) ? d.members.filter((x) => x !== assetId) : [...d.members, assetId];
    d.error = '';
  },

  /** บันทึกไลน์ที่สร้าง: ลงผังพร้อมสมาชิกทั้งหมดในครั้งเดียว (ย้อนกลับได้ 1 ขั้น) */
  saveDraft(): boolean {
    const d = app.draft;
    if (!d) return false;
    const name = d.name.trim();
    if (!name) {
      d.error = 'กรุณาตั้งชื่อไลน์';
      return false;
    }
    if (app.site.lines.some((l) => l.name.trim() === name)) {
      d.error = `มีไลน์ชื่อ "${name}" อยู่แล้ว`;
      return false;
    }
    checkpoint();
    const id = newId('ln');
    app.site.lines.push({ id, name, mode: d.mode, color: d.color });
    for (const a of app.site.assets) if (d.members.includes(a.id)) a.lineId = id;
    app.draft = null;
    app.lineAddMode = null;
    app.activeLineId = id;
    return true;
  },

  cancelDraft() {
    app.draft = null;
    if (app.lineAddMode === DRAFT) app.lineAddMode = null;
  },

  setLineMode(id: string, mode: LineMode) {
    const l = findLine(id);
    if (!l || l.mode === mode) return;
    checkpoint();
    l.mode = mode;
  },

  deleteLine(id: string) {
    if (!findLine(id)) return;
    checkpoint();
    app.site.lines = app.site.lines.filter((l) => l.id !== id);
    for (const a of app.site.assets) if (a.lineId === id) a.lineId = null;
    if (app.activeLineId === id) app.activeLineId = null;
    if (app.lineAddMode === id) app.lineAddMode = null;
  },

  /** เพิ่มเครื่องเข้าไลน์ (ถ้าอยู่ไลน์อื่นจะย้ายมา เพราะอยู่ได้ไลน์เดียว) */
  addToLine(assetId: string, lineId: string) {
    const a = find(assetId);
    if (!a || !findLine(lineId) || a.lineId === lineId) return;
    checkpoint();
    a.lineId = lineId;
  },

  removeFromLine(assetId: string) {
    const a = find(assetId);
    if (!a || !a.lineId) return;
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

  /** ตั้งระดับ (จำนวนเต็ม 1–9) สถานะของระบบตั้งไม่ได้ */
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

  resetFormulas() {
    checkpoint();
    app.site.metrics.mttr = DEFAULT_METRICS.mttr;
    app.site.metrics.mtbf = DEFAULT_METRICS.mtbf;
  },

  // ---------- ผัง ----------
  loadSite(site: Site) {
    replaceSite(site);
  },

  newSite() {
    replaceSite(structuredClone(emptySite));
  },

  // ---------- Undo / Redo ----------
  undo() {
    const prev = history.past.pop();
    if (prev === undefined) return;
    history.future.push(snapshot());
    restore(prev);
  },

  redo() {
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
    checkpoint();
    const src = clipboard;
    const pos = clipFromCut ? { x: src.x, z: src.z } : besideOf(src);
    const keepLine = clipFromCut && src.lineId && findLine(src.lineId) ? src.lineId : null;
    const asset: Asset = { ...src, id: newId(), name: nextName(src.kind), lineId: keepLine, ...pos };
    snapAsset(asset);
    app.site.assets.push(asset);
    clipboard = { ...src, x: asset.x, z: asset.z };
    clipFromCut = false;
  }
};
