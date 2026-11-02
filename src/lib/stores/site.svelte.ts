import { emptySite } from '../domain/sample';
import { MODELS } from '../domain/catalog';
import { footprint, snapAxis } from '../domain/geometry';
import type { Asset, AssetKind, Site } from '../domain/types';
import { loadLocal, saveLocal } from './persist';

export type Mode = 'view' | 'edit';

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
  recent: loadRecent(), // โมเดลที่ใช้ล่าสุด (สูงสุด 6)
  ribbonTab: 'insert' as 'home' | 'insert' | 'view',
  saveState: 'saved' as 'saved' | 'saving' | 'error'
});

// ================= บันทึกอัตโนมัติ =================
// แก้ผังเมื่อไหร่ รอ 0.5 วินาทีหลังแก้ครั้งสุดท้ายแล้วค่อยบันทึก (ไม่บันทึกทุกครั้งที่ลากผ่านกริด)
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
// เก็บภาพรวมของ asset ทั้งหมดเป็น JSON ก่อนทุกการแก้ไข
const HISTORY_LIMIT = 100;
export const history = $state({ past: [] as string[], future: [] as string[] });

const snapshot = () => JSON.stringify(app.site.assets);

function restore(json: string) {
  app.site.assets = JSON.parse(json) as Asset[];
  if (!app.site.assets.some((a) => a.id === app.selectedId)) app.selectedId = null;
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
const newId = () => `a-${Date.now().toString(36)}-${(seq++).toString(36)}`;

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

/** แทนที่ผังทั้งผัง (Import / ผังใหม่) แล้วล้างประวัติ เพราะย้อนข้ามผังไม่ได้ */
function replaceSite(site: Site) {
  app.site = site;
  app.selectedId = null;
  app.placing = null;
  history.past = [];
  history.future = [];
  clipboard = null;
  clip.has = false;
}

// ================= actions =================
export const actions = {
  setMode(mode: Mode) {
    app.mode = mode;
    app.placing = null;
    // โหมดดูผังมีแค่แท็บมุมมอง
    if (mode === 'view') app.ribbonTab = 'view';
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
    if (!kind || !MODELS[kind]) return;
    checkpoint();
    const c = MODELS[kind];
    const asset: Asset = {
      id: newId(),
      name: nextName(kind),
      kind,
      areaId: null,
      x,
      z,
      w: c.w,
      d: c.d,
      rot,
      status: 'idle'
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

  /**
   * ขยาย/ลดขนาดทีละ 1 ม. ทั้งกว้างและลึกพร้อมกัน (สัดส่วนล็อก)
   * ไม่เล็กกว่าขนาด default ของชนิดนั้น และไม่ใหญ่เกินผัง
   */
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

  /** เริ่มแก้ชื่อ/สถานะในแผงคุณสมบัติ: จำสถานะไว้ก่อน */
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
   * - ตัด (Ctrl+X) แล้ววาง: ครั้งแรกกลับไปที่ตำแหน่งเดิม
   * - คัดลอก (Ctrl+C) แล้ววาง: วางชิดข้างตัวต้นฉบับ
   * - วางซ้ำ: วางชิดต่อจากชิ้นล่าสุดไปเรื่อยๆ
   */
  paste() {
    if (!clipboard) return;
    checkpoint();
    const src = clipboard;
    const pos = clipFromCut ? { x: src.x, z: src.z } : besideOf(src);
    const asset: Asset = { ...src, id: newId(), name: nextName(src.kind), ...pos };
    snapAsset(asset);
    app.site.assets.push(asset);
    clipboard = { ...src, x: asset.x, z: asset.z };
    clipFromCut = false;
  }
};
