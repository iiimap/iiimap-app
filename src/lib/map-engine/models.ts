// โมเดล low-poly สร้างด้วยโค้ด (ไม่ต้องโหลดไฟล์ 3D)
// กติกา: ทุกโมเดลวางกึ่งกลางที่ (0,0) ฐานอยู่ที่ y = 0
//        ขนาดพอดีกับ w × d ของ default ใน catalog (แกน x = กว้าง, แกน z = ลึก, ด้านหน้า = +z)
//        ไฟ Andon ไม่วาดในโมเดล: engine ติดเองด้วย addAndon() ตามจุดติดตั้งใน ANDON_MOUNT
import * as THREE from 'three';

// ---------- วัสดุใช้ร่วมกัน ----------
const M = {
  body: new THREE.MeshStandardMaterial({ color: 0xe8ebef, roughness: 0.55 }),
  bodyAlt: new THREE.MeshStandardMaterial({ color: 0xcfd5dc, roughness: 0.55 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 }),
  black: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.45 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.6 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.1, transparent: true, opacity: 0.55 }),
  screen: new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x0369a1, emissiveIntensity: 0.6 }),
  wood: new THREE.MeshStandardMaterial({ color: 0xc8955a, roughness: 0.9 }),
  carton: new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.9 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.95 })
};

// ---------- ตัวช่วย ----------
/** กล่อง: (x, z) = กึ่งกลาง, y = ระดับฐานของกล่อง */
function box(g: THREE.Group, w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  g.add(m);
  return m;
}

/** ทรงกระบอกตั้ง: y = ระดับฐาน */
function cyl(g: THREE.Group, r: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 16, rTop = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, seg), mat);
  m.position.set(x, y + h / 2, z);
  g.add(m);
  return m;
}

/** เสาไฟ Andon: เสา + โคมไฟสถานะ */
function andon(g: THREE.Group, x: number, y: number, z: number, pole = 0.5) {
  cyl(g, 0.04, pole, M.metal, x, y, z, 8);
  const light = cyl(g, 0.13, 0.32, new THREE.MeshStandardMaterial({ color: 0xffffff }), x, y + pole, z, 16);
  light.userData.statusLight = true;
  cyl(g, 0.14, 0.05, M.dark, x, y + pole + 0.32, z, 16);
  return light;
}

/** จุดติดตั้งเสาไฟ Andon ของแต่ละโมเดล (พิกัดในโมเดล, ฐานเสา) */
export const ANDON_MOUNT: Record<string, { x: number; y: number; z: number; pole: number }> = {
  cnc: { x: 1.25, y: 2.5, z: -1.1, pole: 0.5 },
  injection: { x: -2.2, y: 2.2, z: -0.6, pole: 0.5 },
  press: { x: 1.1, y: 3.8, z: -0.8, pole: 0.3 },
  robot: { x: -0.8, y: 0.18, z: -0.8, pole: 0.9 },
  conveyor: { x: -2.85, y: 0, z: 0.55, pole: 1.1 },
  agv: { x: 0.6, y: 0.46, z: 0, pole: 0.05 },
  assembly: { x: -0.92, y: 1.83, z: -0.42, pole: 0.05 },
  qc: { x: 0.85, y: 0.93, z: -0.38, pole: 0.35 },
  dock: { x: 1.9, y: 3.4, z: -1.85, pole: 0.05 },
  rack: { x: 1.95, y: 3, z: -0.45, pole: 0.1 },
  pallet: { x: 0.35, y: 1.04, z: 0.35, pole: 0.05 },
  plant: { x: 0, y: 1.6, z: 0, pole: 0.05 },
  barrier: { x: 1.4, y: 1, z: 0, pole: 0.05 }
};

/** ติดเสาไฟ Andon ให้โมเดล (คืน group ของเสาไฟ เพื่อถอดออกได้) */
export function addAndon(model: THREE.Object3D, modelId: string): THREE.Group {
  const m = ANDON_MOUNT[modelId] ?? { x: 0, y: 1, z: 0, pole: 0.3 };
  const g = new THREE.Group();
  g.userData.andonGroup = true;
  andon(g, m.x, m.y, m.z, m.pole);
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  model.add(g);
  return g;
}

// ---------- โมเดลแต่ละชนิด ----------
const builders: Record<string, (g: THREE.Group) => void> = {
  cnc(g) {
    box(g, 3, 0.3, 2.8, M.dark); // ฐาน
    box(g, 2.9, 1.9, 2.7, M.body, 0, 0.3); // ตัวเครื่อง
    box(g, 2.9, 0.3, 2.7, M.bodyAlt, 0, 2.2); // ฝาบน
    box(g, 1.7, 1.1, 0.06, M.glass, -0.3, 0.75, 1.36); // หน้าต่าง
    box(g, 1.8, 0.08, 0.1, M.metal, -0.3, 1.9, 1.38); // มือจับ
    box(g, 0.55, 0.75, 0.12, M.dark, 1.05, 0.95, 1.38); // แผงควบคุม
    box(g, 0.45, 0.32, 0.03, M.screen, 1.05, 1.3, 1.45); // จอ HMI
    box(g, 2.9, 0.12, 0.05, M.blue, 0, 2.05, 1.36); // แถบสี
  },

  injection(g) {
    box(g, 5, 0.6, 1.8, M.dark); // ฐานยาว
    box(g, 1.8, 1.4, 1.6, M.body, -1.5, 0.6); // ชุดแคลมป์
    box(g, 1.8, 0.2, 1.6, M.blue, -1.5, 2.0);
    box(g, 0.15, 1.2, 1.4, M.glass, -0.55, 0.7); // ประตูนิรภัย
    box(g, 2.2, 0.9, 1.2, M.bodyAlt, 1.2, 0.6); // ชุดฉีด
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.2, 16), M.metal);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(1.0, 1.75, 0);
    g.add(barrel); // กระบอกฉีด
    cyl(g, 0.12, 0.35, M.metal, 1.8, 1.5, 0); // คอฮอปเปอร์
    cyl(g, 0.12, 0.55, M.orange, 1.8, 1.85, 0, 16, 0.42); // ฮอปเปอร์ (กรวย)
    box(g, 0.6, 0.9, 0.15, M.dark, 0.2, 0.7, 0.95); // ตู้ควบคุม
    box(g, 0.45, 0.3, 0.03, M.screen, 0.2, 1.2, 1.03);
  },

  press(g) {
    box(g, 2.8, 0.5, 2.6, M.dark); // ฐาน
    box(g, 2.2, 0.35, 2.0, M.bodyAlt, 0, 0.5); // โต๊ะแม่พิมพ์
    for (const x of [-1.15, 1.15]) box(g, 0.45, 2.6, 1.6, M.body, x, 0.5); // เสาข้าง
    box(g, 2.8, 0.7, 2.0, M.body, 0, 3.1); // หัวเครื่อง
    box(g, 2.8, 0.12, 0.05, M.orange, 0, 3.4, 1.01);
    box(g, 1.6, 0.6, 1.4, M.blue, 0, 2.1); // ram
    cyl(g, 0.12, 0.6, M.metal, 0, 2.6, 0, 12); // ก้านสูบ
    box(g, 0.08, 0.5, 2.0, M.yellow, -1.35, 0.85); // ม่านแสงนิรภัย
    box(g, 0.08, 0.5, 2.0, M.yellow, 1.35, 0.85);
  },

  robot(g) {
    box(g, 2, 0.08, 2, M.yellow); // แผ่นพื้นเขตอันตราย
    box(g, 1.7, 0.1, 1.7, M.body, 0, 0.08);
    cyl(g, 0.45, 0.35, M.dark, 0, 0.18, 0, 20); // ฐาน
    cyl(g, 0.38, 0.35, M.orange, 0, 0.53, 0, 20); // ตัวหมุน
    // แขนช่วงล่าง (เอียง)
    const arm1 = new THREE.Group();
    arm1.position.set(0, 0.88, 0);
    arm1.rotation.z = -0.35;
    box(arm1, 0.28, 1.0, 0.28, M.orange);
    g.add(arm1);
    // ข้อต่อ + แขนช่วงบน (ยื่นไปข้างหน้า)
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), M.dark);
    elbow.position.set(0.34, 1.82, 0);
    g.add(elbow);
    const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.22), M.orange);
    arm2.position.set(0.72, 1.92, 0);
    arm2.rotation.z = -0.25;
    g.add(arm2);
    box(g, 0.14, 0.3, 0.14, M.metal, 1.12, 1.55, 0); // มือจับ
  },

  conveyor(g) {
    for (const x of [-2.6, 0, 2.6]) for (const z of [-0.38, 0.38]) box(g, 0.08, 0.7, 0.08, M.metal, x, 0, z); // ขา
    box(g, 6, 0.12, 0.9, M.dark, 0, 0.7); // โครง
    box(g, 5.9, 0.06, 0.8, M.rubber, 0, 0.82); // สายพาน
    for (const z of [-0.47, 0.47]) box(g, 6, 0.16, 0.06, M.orange, 0, 0.72, z); // ราวกั้น
    for (const x of [-1.8, 0.2, 2.1]) box(g, 0.5, 0.35, 0.5, M.carton, x, 0.88); // ชิ้นงานบนสายพาน
  },

  agv(g) {
    box(g, 1.9, 0.3, 0.95, M.blue, 0, 0.1); // ตัวรถ
    box(g, 1.9, 0.06, 0.95, M.dark, 0, 0.4); // แผ่นบน
    box(g, 0.08, 0.12, 0.6, M.yellow, 0.95, 0.18); // กันชนหน้า
    for (const x of [-0.65, 0.65]) for (const z of [-0.42, 0.42]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12), M.rubber);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.12, z);
      g.add(wheel);
    }
    box(g, 0.6, 0.15, 0.06, M.screen, -0.4, 0.15, 0.48);
  },

  assembly(g) {
    for (const x of [-0.92, 0.92]) for (const z of [-0.42, 0.42]) box(g, 0.06, 0.85, 0.06, M.metal, x, 0, z);
    box(g, 2, 0.06, 0.95, M.bodyAlt, 0, 0.85); // พื้นโต๊ะ
    box(g, 1.8, 0.04, 0.8, M.metal, 0, 0.2); // ชั้นล่าง
    for (const x of [-0.92, 0.92]) box(g, 0.05, 1.0, 0.05, M.metal, x, 0.91, -0.42); // เสาหลัง
    box(g, 1.9, 0.08, 0.3, M.dark, 0, 1.75, -0.35); // คานไฟ
    box(g, 1.6, 0.03, 0.2, M.screen, 0, 1.72, -0.3);
    for (const x of [-0.5, 0, 0.5]) box(g, 0.3, 0.18, 0.25, M.blue, x, 1.25, -0.4); // กล่องอะไหล่
    box(g, 0.4, 0.15, 0.3, M.carton, 0.4, 0.91, 0.1);
  },

  qc(g) {
    for (const x of [-0.92, 0.92]) box(g, 0.1, 0.85, 0.85, M.bodyAlt, x, 0, 0); // ขาตู้
    box(g, 2, 0.08, 0.95, M.body, 0, 0.85); // พื้นโต๊ะ
    box(g, 0.06, 0.4, 0.06, M.dark, -0.4, 0.93, -0.3); // ขาจอ
    box(g, 0.7, 0.45, 0.05, M.dark, -0.4, 1.25, -0.3); // จอ
    box(g, 0.62, 0.37, 0.02, M.screen, -0.4, 1.29, -0.27);
    box(g, 0.5, 0.06, 0.4, M.black, 0.45, 0.93, 0.05); // แท่นวัด
    box(g, 0.08, 0.45, 0.08, M.metal, 0.6, 0.99, -0.1);
    box(g, 0.3, 0.08, 0.1, M.metal, 0.5, 1.4, -0.1); // หัววัด
  },

  rack(g) {
    for (const x of [-1.95, 0, 1.95]) for (const z of [-0.45, 0.45]) box(g, 0.08, 3, 0.08, M.blue, x, 0, z); // เสา
    for (const y of [0.15, 1.45, 2.75]) for (const z of [-0.45, 0.45]) box(g, 4, 0.1, 0.06, M.orange, 0, y, z); // คาน
    // พาเลท + สินค้าบนแต่ละชั้น
    const filled: [number, number][] = [[-0.98, 0.25], [0.98, 0.25], [-0.98, 1.55], [0.98, 2.85]];
    for (const [x, y] of filled) {
      box(g, 1.6, 0.12, 0.85, M.wood, x, y);
      box(g, 1.4, 0.8, 0.75, M.carton, x, y + 0.12);
    }
  },

  pallet(g) {
    for (const x of [-0.4, 0, 0.4]) box(g, 0.12, 0.1, 0.95, M.wood, x, 0);
    box(g, 0.95, 0.04, 0.95, M.wood, 0, 0.1);
    box(g, 0.42, 0.45, 0.42, M.carton, -0.22, 0.14, -0.22);
    box(g, 0.42, 0.45, 0.42, M.carton, 0.22, 0.14, -0.22);
    box(g, 0.42, 0.45, 0.42, M.carton, -0.22, 0.14, 0.22);
    box(g, 0.42, 0.45, 0.42, M.carton, 0.22, 0.14, 0.22);
    box(g, 0.42, 0.45, 0.42, M.carton, -0.22, 0.59, -0.22);
    box(g, 0.42, 0.45, 0.42, M.carton, 0.22, 0.59, 0.22);
  },

  plant(g) {
    cyl(g, 0.32, 0.5, M.bodyAlt, 0, 0, 0, 16, 0.4); // กระถาง
    cyl(g, 0.36, 0.06, M.dark, 0, 0.5, 0, 16);
    cyl(g, 0.05, 0.4, M.wood, 0, 0.5, 0, 8); // ลำต้น
    const leaf = new THREE.MeshStandardMaterial({ color: 0x4d9a52, roughness: 0.8 });
    const leaves: [number, number, number, number][] = [[0, 1.15, 0, 0.42], [0.18, 0.95, 0.1, 0.3], [-0.2, 1.0, -0.08, 0.3], [0.05, 1.4, -0.05, 0.28]];
    for (const [x, y, z, r] of leaves) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leaf);
      s.position.set(x, y, z);
      s.userData.ownMaterial = true;
      g.add(s);
    }
  },

  barrier(g) {
    for (const x of [-1.4, 0, 1.4]) {
      cyl(g, 0.18, 0.06, M.dark, x, 0, 0, 12); // ฐาน
      cyl(g, 0.04, 0.95, M.yellow, x, 0.06, 0, 8); // เสา
    }
    for (const y of [0.45, 0.85]) {
      box(g, 2.8, 0.08, 0.04, M.yellow, 0, y, 0); // ราว
    }
    for (let i = 0; i < 6; i++) box(g, 0.2, 0.09, 0.05, M.black, -1.2 + i * 0.48, 0.85, 0); // แถบดำ
  },

  dock(g) {
    box(g, 4, 0.06, 4, M.bodyAlt); // พื้น dock
    // แถบเหลือง-ดำหน้าประตู
    for (let i = 0; i < 8; i++) box(g, 0.5, 0.02, 0.4, i % 2 ? M.black : M.yellow, -1.75 + i * 0.5, 0.06, -1.5);
    for (const x of [-1.9, 1.9]) box(g, 0.2, 3.2, 0.3, M.dark, x, 0, -1.85); // วงกบ
    box(g, 4, 0.3, 0.3, M.dark, 0, 3.1, -1.85);
    box(g, 3.6, 2.6, 0.08, M.metal, 0, 0.5, -1.9); // ประตูม้วน (เปิดครึ่ง)
    for (let y = 0.7; y < 3.1; y += 0.3) box(g, 3.6, 0.02, 0.1, M.bodyAlt, 0, y, -1.85);
    for (const x of [-1.2, 1.2]) box(g, 0.3, 0.4, 0.2, M.rubber, x, 0.06, -1.75); // กันชน
    box(g, 2.6, 0.06, 1.4, M.metal, 0, 0.06, -1.0); // dock leveler
  }
};

/** สร้างโมเดลตาม id (ถ้าไม่รู้จักจะได้กล่องสีเทา) */
export function buildModel(id: string, fallback = { w: 1, d: 1, h: 1 }): THREE.Group {
  const g = new THREE.Group();
  const build = builders[id];
  if (build) build(g);
  else box(g, fallback.w, fallback.h, fallback.d, M.bodyAlt);
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

/** ตั้งสีไฟ Andon ของโมเดล */
export function setStatusColor(g: THREE.Object3D, color: number) {
  g.traverse((o) => {
    if (!o.userData.statusLight) return;
    const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
    mat.color.setHex(color);
    mat.emissive.setHex(color);
    mat.emissiveIntensity = 0.7;
  });
}

/** ทำลาย geometry ของโมเดล (วัสดุที่ใช้ร่วมกันไม่ต้องทำลาย) */
export function disposeModel(g: THREE.Object3D) {
  g.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh && !(o as THREE.LineSegments).isLineSegments) return;
    mesh.geometry.dispose();
    if (o.userData.statusLight || o.userData.ownMaterial) (mesh.material as THREE.Material).dispose();
  });
}
