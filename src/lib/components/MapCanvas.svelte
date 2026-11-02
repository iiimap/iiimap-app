<script lang="ts">
  import { onMount } from 'svelte';
  import { MapEngine } from '../map-engine/MapEngine';
  import { app, actions } from '../stores/site.svelte';

  let { engine = $bindable() }: { engine?: MapEngine } = $props();
  let container: HTMLDivElement;

  onMount(() => {
    const e = new MapEngine(container, {
      onSelect: (id) => (app.selectedId = id),
      onPlace: (x, z, rot) => actions.place(x, z, rot),
      onMoveStart: () => actions.moveStart(),
      onMove: (id, x, z) => actions.move(id, x, z),
      onZoom: (z) => (app.zoom = z),
      onHover: (id) => (app.hoverId = id)
    });
    engine = e;
    return () => e.dispose();
  });

  // สร้างพื้นผังใหม่เมื่อขนาดผังเปลี่ยน (เช่น Import ผังอื่นเข้ามา)
  $effect(() => {
    const { width, depth, id } = app.site;
    engine?.loadSite({ width, depth, id, name: '', tenantId: '', areas: [], assets: [] });
  });

  // ส่งข้อมูลจาก store เข้า map engine ทุกครั้งที่เปลี่ยน
  $effect(() => {
    engine?.syncAssets($state.snapshot(app.site.assets));
  });
  $effect(() => {
    engine?.setSelected(app.selectedId);
  });
  $effect(() => {
    engine?.setMode(app.mode);
  });
  $effect(() => {
    engine?.setGridVisible(app.showGrid);
  });
  $effect(() => {
    engine?.setPlacing(app.placing, app.placeRot);
  });
</script>

<div class="map" class:placing={app.placing} bind:this={container}></div>

<style>
  .map { position: absolute; inset: 0; cursor: grab; }
  .map.placing { cursor: crosshair; }
</style>
