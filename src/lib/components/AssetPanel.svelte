<script lang="ts">
  import { app } from '../stores/site.svelte';

  const LABEL = { running: 'ทำงาน', idle: 'รอ', alarm: 'ALARM', offline: 'ออฟไลน์' };
  let asset = $derived(app.site.assets.find((a) => a.id === app.selectedId));
  let counts = $derived(
    app.site.assets.reduce((c, a) => ((c[a.status] = (c[a.status] ?? 0) + 1), c), {} as Record<string, number>)
  );
</script>

<aside>
  <h1>iiiMap</h1>
  <p class="site">{app.site.name}</p>
  <ul class="kpi">
    {#each Object.entries(LABEL) as [k, label]}
      <li class={k}><b>{counts[k] ?? 0}</b> {label}</li>
    {/each}
  </ul>
  {#if asset}
    <div class="card">
      <h2>{asset.name}</h2>
      <p>ประเภท: {asset.kind}</p>
      <p>สถานะ: <span class={asset.status}>{LABEL[asset.status]}</span></p>
    </div>
  {:else}
    <p class="hint">คลิกที่เครื่องบนผังเพื่อดูรายละเอียด · scroll เพื่อซูม</p>
  {/if}
</aside>

<style>
  aside {
    position: absolute; top: 16px; left: 16px; width: 260px; padding: 16px;
    background: rgba(15, 23, 42, 0.9); color: #e2e8f0; border-radius: 12px;
    font-family: system-ui, sans-serif; border: 1px solid #1e293b;
  }
  h1 { margin: 0; font-size: 20px; color: #38bdf8; }
  h2 { margin: 0 0 8px; font-size: 16px; }
  .site { margin: 4px 0 12px; color: #94a3b8; font-size: 13px; }
  .kpi { list-style: none; padding: 0; margin: 0 0 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 13px; }
  .kpi li { background: #0f172a; padding: 6px 8px; border-radius: 6px; }
  .card { background: #0f172a; padding: 12px; border-radius: 8px; font-size: 14px; }
  .card p { margin: 4px 0; }
  .hint { color: #64748b; font-size: 13px; }
  .running { color: #22c55e; } .idle { color: #fbbf24; } .alarm { color: #ef4444; } .offline { color: #94a3b8; }
</style>
