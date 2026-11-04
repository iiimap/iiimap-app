// คำนวณตำแหน่งบนกริด ใช้ร่วมกันทั้ง map engine และ store

/** ขนาดจริงบนผังหลังหมุน */
export function footprint(w: number, d: number, rot: number): [number, number] {
  return rot % 2 === 0 ? [w, d] : [d, w];
}

/**
 * snap จุดกึ่งกลางให้ขอบวัตถุตรงกับเส้นกริด 1 ม. และไม่หลุดขอบผัง
 *
 * กรณีก้ำกึ่ง (อยู่กลางระหว่างสองช่องพอดี) เกิดตอนหมุนหรือขยายวัตถุที่ด้านคี่/คู่สลับกัน
 * ถ้าปัดทางเดียวกันตลอด วัตถุจะเลื่อนไปทีละครึ่งเมตรทุกครั้งที่หมุน จนชนขอบ
 * จึงปัดขึ้นเมื่อขนาดเป็นเลขคู่ และปัดลงเมื่อเป็นเลขคี่
 * ผลคือ หมุนครบรอบ หรือขยายแล้วลดกลับ จะกลับมาที่ตำแหน่งเดิมเป๊ะ
 */
export function snapAxis(center: number, size: number, siteSize: number): number {
  const half = size / 2;
  const v = center - half;
  const frac = v - Math.floor(v);
  const isTie = Math.abs(frac - 0.5) < 1e-6;
  const even = Math.round(size) % 2 === 0;
  const edge = isTie ? (even ? Math.ceil(v) : Math.floor(v)) : Math.round(v);
  const snapped = edge + half;
  const limit = siteSize / 2 - half;
  return Math.max(-limit, Math.min(limit, snapped));
}
