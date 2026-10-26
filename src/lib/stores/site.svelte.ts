import { sampleSite } from '../domain/sample';
import type { Site } from '../domain/types';

// state กลางของแอป (Svelte 5 runes)
export const app = $state({
  site: sampleSite as Site,
  selectedId: null as string | null
});
