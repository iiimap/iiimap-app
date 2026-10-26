// Map engine: Three.js ล้วน ไม่ผูกกับ Svelte
import * as THREE from 'three';
import type { Asset, AssetStatus, Site } from '../domain/types';

export const STATUS_COLOR: Record<AssetStatus, number> = {
  running: 0x22c55e,
  idle: 0xfbbf24,
  alarm: 0xef4444,
  offline: 0x64748b
};

export class MapEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private assetMeshes = new Map<string, THREE.Mesh>();
  private zoom = 1;
  private frame = 0;
  private resizeObs: ResizeObserver;

  constructor(
    private container: HTMLElement,
    private onSelect: (assetId: string | null) => void
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x070b12);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(30, 50, 20);
    this.scene.add(sun);

    // กล้อง isometric (มุม 2.5D)
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 500);
    this.camera.position.set(40, 40, 40);
    this.camera.lookAt(0, 0, 0);

    this.renderer.domElement.addEventListener('click', this.handleClick);
    this.renderer.domElement.addEventListener('wheel', this.handleWheel, { passive: false });
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    this.loop();
  }

  loadSite(site: Site) {
    // พื้น
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(site.width, 0.4, site.depth),
      new THREE.MeshStandardMaterial({ color: 0x111622 })
    );
    floor.position.y = -0.2;
    this.scene.add(floor);

    // โซน
    for (const a of site.areas) {
      const zone = new THREE.Mesh(
        new THREE.BoxGeometry(a.w, 0.05, a.d),
        new THREE.MeshStandardMaterial({ color: a.color })
      );
      zone.position.set(a.x, 0.03, a.z);
      this.scene.add(zone);
    }

    // asset
    for (const asset of site.assets) {
      const h = asset.kind === 'dock' ? 0.6 : 2.5;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(asset.w, h, asset.d),
        new THREE.MeshStandardMaterial({ color: STATUS_COLOR[asset.status] })
      );
      mesh.position.set(asset.x, h / 2, asset.z);
      mesh.userData.assetId = asset.id;
      this.scene.add(mesh);
      this.assetMeshes.set(asset.id, mesh);
    }
  }

  updateStatus(asset: Asset) {
    const mesh = this.assetMeshes.get(asset.id);
    if (mesh) (mesh.material as THREE.MeshStandardMaterial).color.setHex(STATUS_COLOR[asset.status]);
  }

  setSelected(id: string | null) {
    for (const [aid, mesh] of this.assetMeshes) {
      (mesh.material as THREE.MeshStandardMaterial).emissive.setHex(aid === id ? 0x38bdf8 : 0x000000);
    }
  }

  private handleClick = (e: MouseEvent) => {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects([...this.assetMeshes.values()])[0];
    this.onSelect(hit ? (hit.object.userData.assetId as string) : null);
  };

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.zoom = THREE.MathUtils.clamp(this.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.3, 5);
    this.resize();
  };

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const view = 30 / this.zoom;
    const aspect = w / h;
    this.camera.left = -view * aspect;
    this.camera.right = view * aspect;
    this.camera.top = view;
    this.camera.bottom = -view;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private loop = () => {
    this.frame = requestAnimationFrame(this.loop);
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resizeObs.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
