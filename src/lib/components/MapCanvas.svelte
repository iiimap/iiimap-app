<script lang="ts">
  import { onMount } from 'svelte';
  import { MapEngine } from '../map-engine/MapEngine';
  import { app } from '../stores/site.svelte';

  let container: HTMLDivElement;
  let engine: MapEngine | undefined;

  onMount(() => {
    engine = new MapEngine(container, (id) => (app.selectedId = id));
    engine.loadSite(app.site);
    return () => engine?.dispose();
  });

  $effect(() => {
    engine?.setSelected(app.selectedId);
  });
</script>

<div class="map" bind:this={container}></div>

<style>
  .map { position: absolute; inset: 0; }
</style>
