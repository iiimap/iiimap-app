// บันทึกผังลงเบราว์เซอร์ (localStorage) และ Export / Import เป็นไฟล์
// ตอนมี backend จะเปลี่ยนแค่ไฟล์นี้ให้ไปบันทึกที่ server แทน
import type { Site } from '../domain/types';
import { fromFile, toFile } from '../domain/serialize';

const KEY = 'iiimap.site';

export function loadLocal(): Site | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? fromFile(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveLocal(site: Site): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(toFile(site)));
    return true;
  } catch {
    return false; // เบราว์เซอร์ไม่อนุญาต หรือพื้นที่เต็ม
  }
}

/** ดาวน์โหลดผังเป็นไฟล์ .json */
export function exportFile(site: Site) {
  const blob = new Blob([JSON.stringify(toFile(site), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const safeName = site.name.replace(/[^\p{L}\p{N}_-]+/gu, '-') || 'site';
  const a = document.createElement('a');
  a.href = url;
  a.download = `iiimap-${safeName}-${date}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** อ่านไฟล์ผังที่ผู้ใช้เลือก */
export async function readFile(file: File): Promise<Site | null> {
  try {
    return fromFile(JSON.parse(await file.text()));
  } catch {
    return null;
  }
}
