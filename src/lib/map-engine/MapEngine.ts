// Map engine: Three.js ล้วน ไม่ผูกกับ Svelte
// รับข้อมูลเข้าผ่าน method (syncAssets, setMode, setPlacing ...)
// และส่งเหตุการณ์ออกผ่าน events (onSelect, onPlace, onMove ...)
import * as THREE from 'three';
import type { Asset, AssetKind, AssetStatus, Site } from '../domain/types';
import { MODELS } from '../domain/catalog';
import { buildModel, setStatusColor, disposeModel } from './models';
import { footprint, snapAxis } from '../domain/geometry';
import { theme } from './theme';

export const STATUS_COLOR: Record<AssetStatus, number> = {
  running: 0x16a34a,
  idle: 0xf59e0b,
  alarm: 0xdc2626,
  offline: 0x94a3b8
};

const VIEW_SIZE = 30; // ครึ่งความสูงของมุมมองเมื่อ zoom = 1 (เมตร)
const ELEVATION = Math.atan(1 / Math.SQRT2); // มุม isometric มาตรฐาน ~35.26°
const CAM_DIST = 100;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;
const DRAG_THRESHOLD = 4; // px ก่อนนับว่าเป็นการลาก

/** ค่าเล็กๆ คงที่ต่อ id (0–0.02 ม.) */
function jitter(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 20) * 0.001;
}

export interface MapEngineEvents {
  onSelect?: (assetId: string | null) => void;
  onPlace?: (x: number, z: number, rot: number) => void;
  onMoveStart?: (assetId: string) => void;
  onMove?: (assetId: string, x: number, z: number) => void;
  onZoom?: (zoom: number) => void;
  onHover?: (assetId: string | null) => void;
}

type Gesture =
  | { type: 'pan'; start: THREE.Vector3 }
  | { type: 'asset'; id: string; offset: THREE.Vector3; started: boolean }
  | null;

export class MapEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private siteGroup = new THREE.Group();
  private assetGroup = new THREE.Group();
  private assetMeshes = new Map<string, THREE.Group>();
  private assetData = new Map<string, Asset>();
  private siteSize = { w: 60, d: 40 };
  private grids: THREE.LineSegments[] = [];
  private gridVisible = true;

  // โหมดและ ghost ตอนวาง
  private mode: 'view' | 'edit' = 'view';
  private placing: AssetKind | null = null;
  private placeRot = 0;
  private ghost: THREE.Group | null = null;
  private ghostMat = new THREE.MeshStandardMaterial({
    color: theme.selection,
    transparent: true,
    opacity: 0.4,
    depthWrite: false
  });
  private selectedId: string | null = null;
  private outline: THREE.LineSegments | null = null;
  private outlineMat = new THREE.LineBasicMaterial({ color: theme.selection, depthTest: false });

  // สถานะกล้อง
  private target = new THREE.Vector3();
  private zoom = 1;
  private angle = Math.PI / 4;
  private angleGoal = Math.PI / 4;

  // สถานะเมาส์
  private gesture: Gesture = null;
  private downPos = { x: 0, y: 0 };
  private moved = false;
  private hover: THREE.Vector3 | null = null; // จุดบนพื้นใต้เมาส์ล่าสุด
  private hoverId: string | null = null; // โมเดลใต้เมาส์

  private frame = 0;
  private resizeObs: ResizeObserver;

  constructor(
    private container: HTMLElement,
    private events: MapEngineEvents = {}
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const el = this.renderer.domElement;
    el.style.display = 'block';
    el.style.touchAction = 'none';
    container.appendChild(el);

    this.scene.background = new THREE.Color(theme.background);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe5ec, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(40, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60;
    sc.updateProjectionMatrix();
    this.scene.add(sun);
    this.scene.add(this.siteGroup, this.assetGroup);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 500);

    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerUp);
    el.addEventListener('pointerleave', this.onPointerLeave);
    el.addEventListener('wheel', this.onWheel, { passive: false });

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    this.updateCamera();
    this.loop();
  }

  // ================= ผัง =================

  loadSite(site: Site) {
    this.siteGroup.clear();
    this.siteSize = { w: site.width, d: site.depth };

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(site.width, 0.3, site.depth),
      new THREE.MeshStandardMaterial({ color: theme.floor, roughness: 0.95 })
    );
    floor.position.y = -0.15;
    floor.receiveShadow = true;
    this.siteGroup.add(floor);

    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(floor.geometry),
      new THREE.LineBasicMaterial({ color: theme.floorEdge })
    );
    edge.position.copy(floor.position);
    this.siteGroup.add(edge);

    this.grids = [
      this.makeGrid(site.width, site.depth, 1, theme.gridMinor, 0.002),
      this.makeGrid(site.width, site.depth, 5, theme.gridMajor, 0.004)
    ];
    for (const g of this.grids) {
      g.visible = this.gridVisible;
      this.siteGroup.add(g);
    }

    this.target.set(0, 0, 0);
    this.updateCamera();
  }

  private makeGrid(w: number, d: number, step: number, color: number, y: number) {
    const pts: number[] = [];
    const hw = w / 2;
    const hd = d / 2;
    for (let x = -hw; x <= hw + 1e-6; x += step) pts.push(x, y, -hd, x, y, hd);
    for (let z = -hd; z <= hd + 1e-6; z += step) pts.push(-hw, y, z, hw, y, z);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color }));
  }

  setGridVisible(visible: boolean) {
    this.gridVisible = visible;
    for (const g of this.grids) g.visible = visible;
  }

  // ================= asset =================

  /** ทำให้โมเดลบนผังตรงกับข้อมูลล่าสุด (เพิ่ม / แก้ / ลบ) */
  syncAssets(assets: Asset[]) {
    const alive = new Set<string>();
    for (const a of assets) {
      alive.add(a.id);
      const def = MODELS[a.kind] ?? { w: a.w, d: a.d, h: 1 };
      let model = this.assetMeshes.get(a.id);
      const prev = this.assetData.get(a.id);
      if (model && prev && prev.kind !== a.kind) {
        this.assetGroup.remove(model);
        disposeModel(model);
        model = undefined;
      }
      if (!model) {
        model = buildModel(a.kind, def);
        model.userData.assetId = a.id;
        this.assetGroup.add(model);
        this.assetMeshes.set(a.id, model);
      }
      // ขยายทุกมิติ: กว้าง/ลึกตามขนาดจริง ความสูงโตตามสัดส่วนพื้นที่ (ขนาด default = scale 1)
      const sx = a.w / def.w;
      const sz = a.d / def.d;
      model.scale.set(sx, Math.sqrt(sx * sz), sz);
      // ยกสูงต่างกันเล็กน้อยต่อชิ้น กันผิวกระพริบตอนวางซ้อน (z-fighting)
      model.position.set(a.x, jitter(a.id), a.z);
      model.rotation.y = (a.rot * Math.PI) / 2;
      if (!prev || prev.status !== a.status || prev.kind !== a.kind) {
        setStatusColor(model, STATUS_COLOR[a.status]);
      }
      this.assetData.set(a.id, { ...a });
    }
    for (const [id, model] of this.assetMeshes) {
      if (alive.has(id)) continue;
      this.assetGroup.remove(model);
      disposeModel(model);
      this.assetMeshes.delete(id);
      this.assetData.delete(id);
    }
    this.refreshOutline();
  }

  setSelected(id: string | null) {
    this.selectedId = id;
    this.refreshOutline();
  }

  /** กรอบสีน้ำเงินรอบของที่เลือก (ขนาดตาม default แล้วขยายตาม scale ของโมเดล) */
  private refreshOutline() {
    if (this.outline) {
      this.outline.parent?.remove(this.outline);
      this.outline.geometry.dispose();
      this.outline = null;
    }
    const model = this.selectedId ? this.assetMeshes.get(this.selectedId) : undefined;
    const a = this.selectedId ? this.assetData.get(this.selectedId) : undefined;
    if (!model || !a) return;
    const def = MODELS[a.kind] ?? { w: a.w, d: a.d, h: 1 };
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(def.w + 0.1, def.h + 0.1, def.d + 0.1));
    this.outline = new THREE.LineSegments(geo, this.outlineMat);
    this.outline.position.y = def.h / 2;
    this.outline.renderOrder = 10;
    model.add(this.outline);
  }

  // ================= โหมดแก้ไข =================

  setMode(mode: 'view' | 'edit') {
    this.mode = mode;
  }

  setPlacing(kind: AssetKind | null, rot = 0) {
    // ชนิดเดิม แค่หมุน: หมุน ghost ที่มีอยู่ แล้ว snap ใหม่ตรงจุดเดิม
    if (kind && kind === this.placing && this.ghost) {
      this.placeRot = rot;
      this.updateGhost();
      return;
    }
    this.placing = kind;
    this.placeRot = rot;
    if (this.ghost) {
      this.scene.remove(this.ghost);
      disposeModel(this.ghost);
      this.ghost = null;
    }
    if (!kind || !MODELS[kind]) return;
    // ghost = โมเดลจริงแต่เป็นสีฟ้าโปร่งใส
    this.ghost = buildModel(kind, MODELS[kind]);
    this.ghost.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (o.userData.statusLight) (mesh.material as THREE.Material).dispose();
      o.userData.statusLight = false;
      mesh.material = this.ghostMat;
      mesh.castShadow = false;
    });
    this.ghost.rotation.y = (this.ghostRot() * Math.PI) / 2;
    this.ghost.visible = false;
    this.scene.add(this.ghost);
  }

  /** กล้องหมุนไปแล้วกี่ครั้ง (ทีละ 90°) จากมุมเริ่มต้น */
  private viewTurns() {
    return Math.round((this.angleGoal - Math.PI / 4) / (Math.PI / 2));
  }

  /** มุมหมุนจริงของโมเดลที่จะวาง = มุมที่ผู้ใช้กด R + มุมกล้อง
   *  ทำให้โมเดลหันหน้าเข้าหาผู้ใช้เสมอ ไม่ว่าจะหมุนผังไปทางไหน */
  private ghostRot() {
    return (((this.placeRot + this.viewTurns()) % 4) + 4) % 4;
  }

  private updateGhost() {
    if (!this.ghost || !this.placing) return;
    const rot = this.ghostRot();
    this.ghost.rotation.y = (rot * Math.PI) / 2;
    const c = MODELS[this.placing];
    const s = this.snap(this.ghost.position, c.w, c.d, rot);
    this.ghost.position.x = s.x;
    this.ghost.position.z = s.z;
  }

  /** snap ตำแหน่งกึ่งกลางของวัตถุขนาด w×d ที่หมุน rot */
  private snap(p: THREE.Vector3, w: number, d: number, rot: number) {
    const [fw, fd] = footprint(w, d, rot);
    return {
      x: snapAxis(p.x, fw, this.siteSize.w),
      z: snapAxis(p.z, fd, this.siteSize.d)
    };
  }

  /** ตำแหน่งบนพื้นใต้เมาส์ตอนนี้ (null ถ้าเมาส์อยู่นอกผัง) */
  getHoverPoint(): { x: number; z: number } | null {
    if (!this.hover) return null;
    const { w, d } = this.siteSize;
    if (Math.abs(this.hover.x) > w / 2 || Math.abs(this.hover.z) > d / 2) return null;
    return { x: this.hover.x, z: this.hover.z };
  }

  private setHover(id: string | null) {
    if (id === this.hoverId) return;
    this.hoverId = id;
    this.events.onHover?.(id);
  }

  /** ตำแหน่งบนจอ (px ภายใน canvas) ของจุดเหนือหัวโมเดล ใช้วางป้ายชื่อ */
  getLabelAnchor(id: string): { x: number; y: number } | null {
    const model = this.assetMeshes.get(id);
    const a = this.assetData.get(id);
    if (!model || !a) return null;
    const def = MODELS[a.kind] ?? { h: 1 };
    const p = new THREE.Vector3(0, def.h + 0.2, 0);
    model.localToWorld(p);
    p.project(this.camera);
    const el = this.renderer.domElement;
    return { x: ((p.x + 1) / 2) * el.clientWidth, y: ((1 - p.y) / 2) * el.clientHeight };
  }

  // ================= กล้อง =================

  rotate(dir: 1 | -1) {
    this.angleGoal += (dir * Math.PI) / 2;
    this.updateGhost(); // โมเดลที่กำลังวางหมุนตามกล้อง
  }

  zoomBy(factor: number) {
    this.setZoom(this.zoom * factor);
  }

  resetView() {
    this.target.set(0, 0, 0);
    this.angleGoal = this.angle - ((this.angle - Math.PI / 4) % (Math.PI * 2));
    this.setZoom(1);
    this.updateCamera();
    this.updateGhost();
  }

  private setZoom(z: number) {
    this.zoom = THREE.MathUtils.clamp(z, MIN_ZOOM, MAX_ZOOM);
    this.updateProjection();
    this.events.onZoom?.(this.zoom);
  }

  private updateCamera() {
    const horiz = Math.cos(ELEVATION) * CAM_DIST;
    this.camera.position.set(
      this.target.x + Math.sin(this.angle) * horiz,
      this.target.y + Math.sin(ELEVATION) * CAM_DIST,
      this.target.z + Math.cos(this.angle) * horiz
    );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  private updateProjection() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    const view = VIEW_SIZE / this.zoom;
    const aspect = w / h;
    this.camera.left = -view * aspect;
    this.camera.right = view * aspect;
    this.camera.top = view;
    this.camera.bottom = -view;
    this.camera.updateProjectionMatrix();
  }

  private resize() {
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.updateProjection();
  }

  // ================= เมาส์ =================

  private setRay(clientX: number, clientY: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - r.left) / r.width) * 2 - 1,
      -((clientY - r.top) / r.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
  }

  /** จุดบนพื้น (y=0) ใต้ตำแหน่งเมาส์ */
  private groundAt(clientX: number, clientY: number): THREE.Vector3 | null {
    this.setRay(clientX, clientY);
    return this.raycaster.ray.intersectPlane(this.groundPlane, new THREE.Vector3());
  }

  private assetAt(clientX: number, clientY: number): string | null {
    this.setRay(clientX, clientY);
    const hits = this.raycaster.intersectObjects([...this.assetMeshes.values()], true);
    for (const h of hits) {
      if ((h.object as THREE.LineSegments).isLineSegments) continue; // ข้ามกรอบเลือก
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.assetId) o = o.parent;
      if (o) return o.userData.assetId as string;
    }
    return null;
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    // ออกจากช่องกรอกในแผง เพื่อให้คีย์ลัด (R / Del) ใช้ได้ทันที
    (document.activeElement as HTMLElement | null)?.blur?.();
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.downPos = { x: e.clientX, y: e.clientY };
    this.moved = false;

    // โหมดแก้ไข + ไม่ได้กำลังวาง: กดบนเครื่อง = เลือกแล้วลากย้ายได้
    if (this.mode === 'edit' && !this.placing) {
      const id = this.assetAt(e.clientX, e.clientY);
      const ground = this.groundAt(e.clientX, e.clientY);
      const mesh = id ? this.assetMeshes.get(id) : undefined;
      if (id && mesh && ground) {
        this.events.onSelect?.(id);
        this.gesture = { type: 'asset', id, offset: mesh.position.clone().setY(0).sub(ground), started: false };
        return;
      }
    }

    const start = this.groundAt(e.clientX, e.clientY);
    this.gesture = start ? { type: 'pan', start } : null;
  };

  private onPointerMove = (e: PointerEvent) => {
    this.hover = this.groundAt(e.clientX, e.clientY);
    if (this.gesture && Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y) > DRAG_THRESHOLD) {
      this.moved = true;
    }

    // ghost ตามเมาส์ตอนกำลังวาง
    if (this.ghost && this.placing && !(this.gesture && this.moved)) {
      const p = this.groundAt(e.clientX, e.clientY);
      if (p) {
        const c = MODELS[this.placing];
        const s = this.snap(p, c.w, c.d, this.ghostRot());
        this.ghost.position.x = s.x;
        this.ghost.position.z = s.z;
        this.ghost.visible = true;
      }
    }

    // ชี้เมาส์บนโมเดล (เฉพาะตอนไม่ได้ลาก และไม่ได้กำลังวาง)
    if (!this.gesture && !this.placing) this.setHover(this.assetAt(e.clientX, e.clientY));

    if (!this.gesture || !this.moved) return;
    this.setHover(null);

    if (this.gesture.type === 'pan') {
      this.renderer.domElement.style.cursor = 'grabbing';
      if (this.ghost) this.ghost.visible = false;
      const now = this.groundAt(e.clientX, e.clientY);
      if (!now) return;
      this.target.add(this.gesture.start.clone().sub(now));
      this.updateCamera();
    } else {
      const a = this.assetData.get(this.gesture.id);
      const p = this.groundAt(e.clientX, e.clientY);
      if (!a || !p) return;
      this.renderer.domElement.style.cursor = 'move';
      if (!this.gesture.started) {
        this.gesture.started = true;
        this.events.onMoveStart?.(a.id);
      }
      const s = this.snap(p.add(this.gesture.offset), a.w, a.d, a.rot);
      if (s.x !== a.x || s.z !== a.z) this.events.onMove?.(a.id, s.x, s.z);
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    const g = this.gesture;
    this.gesture = null;
    this.renderer.domElement.style.cursor = '';
    if (!g || this.moved || g.type !== 'pan') return;

    // คลิก (ไม่ได้ลาก)
    if (this.mode === 'edit' && this.placing && this.ghost?.visible) {
      this.events.onPlace?.(this.ghost.position.x, this.ghost.position.z, this.ghostRot());
    } else {
      this.events.onSelect?.(this.assetAt(e.clientX, e.clientY));
    }
  };

  private onPointerLeave = () => {
    this.hover = null;
    this.setHover(null);
    if (this.ghost && !this.gesture) this.ghost.visible = false;
  };

  /** ซูมเข้าหาตำแหน่งเมาส์ */
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const before = this.groundAt(e.clientX, e.clientY);
    this.setZoom(this.zoom * (e.deltaY > 0 ? 0.9 : 1.1));
    this.updateCamera();
    const after = this.groundAt(e.clientX, e.clientY);
    if (before && after) {
      this.target.add(before.sub(after));
      this.updateCamera();
    }
  };

  // ================= render loop =================

  private loop = () => {
    this.frame = requestAnimationFrame(this.loop);
    if (Math.abs(this.angleGoal - this.angle) > 1e-4) {
      this.angle += (this.angleGoal - this.angle) * 0.18;
      if (Math.abs(this.angleGoal - this.angle) < 1e-3) this.angle = this.angleGoal;
      this.updateCamera();
    }
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resizeObs.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointercancel', this.onPointerUp);
    el.removeEventListener('pointerleave', this.onPointerLeave);
    el.removeEventListener('wheel', this.onWheel);
    this.renderer.dispose();
    el.remove();
  }
}
