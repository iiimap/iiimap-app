import type { Site } from './types';

// ข้อมูลจำลองสำหรับเดโม
export const sampleSite: Site = {
  id: 'site-1',
  tenantId: 'demo',
  name: 'Demo Plant – Rayong',
  width: 60,
  depth: 40,
  areas: [
    { id: 'a1', name: 'Line A', x: -15, z: -8, w: 26, d: 14, color: '#1e3a5f' },
    { id: 'a2', name: 'Line B', x: 15, z: -8, w: 26, d: 14, color: '#1e3a5f' },
    { id: 'a3', name: 'Shipping', x: 0, z: 12, w: 50, d: 10, color: '#3b2f1e' }
  ],
  assets: [
    { id: 'm1', name: 'A-01', kind: 'machine', areaId: 'a1', x: -24, z: -8, w: 3, d: 3, status: 'running' },
    { id: 'm2', name: 'A-02', kind: 'machine', areaId: 'a1', x: -15, z: -8, w: 3, d: 3, status: 'idle' },
    { id: 'm3', name: 'A-03', kind: 'machine', areaId: 'a1', x: -6, z: -8, w: 3, d: 3, status: 'running' },
    { id: 'm4', name: 'B-01', kind: 'machine', areaId: 'a2', x: 6, z: -8, w: 3, d: 3, status: 'alarm' },
    { id: 'm5', name: 'B-02', kind: 'machine', areaId: 'a2', x: 15, z: -8, w: 3, d: 3, status: 'running' },
    { id: 'm6', name: 'B-03', kind: 'machine', areaId: 'a2', x: 24, z: -8, w: 3, d: 3, status: 'offline' },
    { id: 'd1', name: 'Dock 1', kind: 'dock', areaId: 'a3', x: -15, z: 14, w: 5, d: 4, status: 'idle' },
    { id: 'd2', name: 'Dock 2', kind: 'dock', areaId: 'a3', x: 0, z: 14, w: 5, d: 4, status: 'running' },
    { id: 'd3', name: 'Dock 3', kind: 'dock', areaId: 'a3', x: 15, z: 14, w: 5, d: 4, status: 'alarm' }
  ]
};
