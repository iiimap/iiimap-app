import type { Site } from './types';

// ผังเปล่า ขนาด 60 x 40 เมตร
export const emptySite: Site = {
  id: 'site-1',
  tenantId: 'demo',
  name: 'New Plant',
  width: 60,
  depth: 40,
  areas: [],
  assets: []
};
