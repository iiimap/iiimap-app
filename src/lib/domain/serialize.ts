// แปลงผังเป็นไฟล์ / อ่านผังจากไฟล์ (ใช้ทั้งบันทึกอัตโนมัติ และ Export / Import)
import type { Asset, Site } from './types';

export const FILE_FORMAT = 'iiimap-site';
export const FILE_VERSION = 1;

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

function isAsset(a: any): a is Asset {
  return (
    a && isStr(a.id) && isStr(a.name) && isStr(a.kind) &&
    isNum(a.x) && isNum(a.z) && isNum(a.w) && isNum(a.d) && isNum(a.rot) &&
    ['running', 'idle', 'alarm', 'offline'].includes(a.status)
  );
}

/** ตรวจและอ่านไฟล์ผัง คืน null ถ้าไฟล์ไม่ถูกต้อง */
export function fromFile(data: unknown): Site | null {
  const f = data as SiteFile;
  if (!f || f.format !== FILE_FORMAT || !isNum(f.version) || f.version > FILE_VERSION) return null;
  const s = f.site as Site;
  if (!s || !isStr(s.name) || !isNum(s.width) || !isNum(s.depth) || !Array.isArray(s.assets)) return null;
  const assets = s.assets.filter(isAsset).map((a) => ({ ...a, areaId: a.areaId ?? null }));
  return {
    id: isStr(s.id) ? s.id : 'site-1',
    tenantId: isStr(s.tenantId) ? s.tenantId : 'demo',
    name: s.name,
    width: s.width,
    depth: s.depth,
    areas: Array.isArray(s.areas) ? s.areas : [],
    assets
  };
}
