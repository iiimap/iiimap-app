<script lang="ts">
  // ป้ายชื่อโมเดล: แสดงเฉพาะตัวที่เมาส์ชี้ และตัวที่เลือกอยู่
  // เป็น HTML ซ้อนบน canvas จึงคมชัดทุกระดับซูม และพิมพ์ภาษาไทยได้สวย
  import type { MapEngine } from '../map-engine/MapEngine';
  import { STATUS_LABEL } from '../domain/catalog';
  import { app } from '../stores/site.svelte';

  let { engine }: { engine?: MapEngine } = $props();

  let ids = $derived([...new Set([app.selectedId, app.hoverId])].filter((x): x is string => !!x));
  let labels = $derived(
    ids.map((id) => app.site.assets.find((a) => a.id === id)).filter((a) => !!a)
  );
  let pos = $state<Record<string, { x: number; y: number }>>({});

  // ตามตำแหน่งโมเดลทุกเฟรม (เฉพาะตอนมีป้ายแสดงอยู่)
  $effect(() => {
    if (!engine || ids.length === 0) return;
    const list = ids;
    let raf = 0;
    const tick = () => {
      const next: Record<string, { x: number; y: number }> = {};
      for (const id of list) {
        const p = engine!.getLabelAnchor(id);
        if (p) next[id] = p;
      }
      pos = next;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  });
</script>

{#each labels as a (a!.id)}
  {@const p = pos[a!.id]}
  {#if p}
    <div class="label" class:selected={a!.id === app.selectedId} style="left:{p.x}px; top:{p.y}px">
      <span class="dot {a!.status}" title={STATUS_LABEL[a!.status]}></span>
      {a!.name}
    </div>
  {/if}
{/each}

<style>
  .label {
    position: absolute; transform: translate(-50%, -100%); pointer-events: none;
    display: flex; align-items: center; gap: 6px; white-space: nowrap;
    padding: 4px 9px; border-radius: 999px;
    background: rgba(255, 255, 255, 0.95); border: 1px solid #e2e8f0;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
    font: 600 12px system-ui, sans-serif; color: #0f172a;
  }
  .label.selected { border-color: #2563eb; color: #1d4ed8; }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .running { background: #16a34a; } .idle { background: #f59e0b; }
  .alarm { background: #dc2626; } .offline { background: #94a3b8; }
</style>
