// คำนวณตำแหน่งบนกริด ใช้ร่วมกันทั้ง map engine และ store

/** ขนาดจริงบนผังหลังหมุน */
export function footprint(w: number, d: number, rot: number): [number, number] {
  return rot % 2 === 0 ? [w, d] : [d, w];
}

/** snap จุดกึ่งกลางให้ขอบวัตถุตรงกับเส้นกริด 1 ม. และไม่หลุดขอบผัง */
export function snapAxis(center: number, size: number, siteSize: number): number {
  const half = size / 2;
  const snapped = Math.round(center - half) + half;
  const limit = siteSize / 2 - half;
  return Math.max(-limit, Math.min(limit, snapped));
}
