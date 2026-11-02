// สร้างรูปตัวอย่างโมเดล (มุม isometric) สำหรับแผงซ้าย
import * as THREE from 'three';
import { buildModel, setStatusColor, disposeModel, addAndon } from './models';
import { MODELS } from '../domain/catalog';

let cache: Record<string, string> | null = null;

export function getThumbnails(size = 112): Record<string, string> {
  if (cache) return cache;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(2);
  renderer.setSize(size, size);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe5ec, 2.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.3);
  sun.position.set(4, 8, 6);
  scene.add(sun);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
  const dir = new THREE.Vector3(1, 0.85, 1.25).normalize();
  const result: Record<string, string> = {};

  for (const def of Object.values(MODELS)) {
    const model = buildModel(def.id, def);
    if (def.andon !== 'none') addAndon(model, def.id); // รูปตัวอย่างโชว์เสาไฟถ้าประเภทนี้รองรับ
    setStatusColor(model, 0x16a34a);
    scene.add(model);

    const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
    const r = sphere.radius * 0.92;
    Object.assign(camera, { left: -r, right: r, top: r, bottom: -r });
    camera.updateProjectionMatrix();
    camera.position.copy(sphere.center).addScaledVector(dir, 20);
    camera.lookAt(sphere.center);

    renderer.render(scene, camera);
    result[def.id] = renderer.domElement.toDataURL('image/png');
    scene.remove(model);
    disposeModel(model);
  }

  renderer.dispose();
  renderer.forceContextLoss();
  cache = result;
  return result;
}
