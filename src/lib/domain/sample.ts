import type { Site } from './types';
import { DEFAULT_ANDON_STATES, DEFAULT_KPIS, DEFAULT_METRICS, DEFAULT_REASONS } from './defaults';

// ผังเปล่า ขนาด 60 x 40 เมตร
export const emptySite: Site = {
  id: 'site-1',
  tenantId: 'demo',
  name: 'New Plant',
  width: 60,
  depth: 40,
  lines: [],
  andonStates: DEFAULT_ANDON_STATES,
  metrics: DEFAULT_METRICS,
  kpis: DEFAULT_KPIS,
  reasons: DEFAULT_REASONS,
  incidents: [],
  assets: []
};
