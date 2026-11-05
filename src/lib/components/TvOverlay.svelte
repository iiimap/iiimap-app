<script lang="ts">
  // โหมดจอ TV: ผังเต็มจอ + แถบสรุปด้านบน + รายการเรื่อง Andon ที่เปิดอยู่ด้านขวา (ดูอย่างเดียว)
  import type { MapEngine } from '../map-engine/MapEngine';
  import { app, actions, clock } from '../stores/site.svelte';
  import { computeKpis, fmtNum } from '../domain/kpi';
  import { stageOf, STAGE_LABEL, fmtDuration } from '../domain/incident';

  let { engine }: { engine?: MapEngine } = $props();

  // เข้าโหมด TV: ซูมให้เห็นทั้งผัง
  $effect(() => {
    if (app.tvMode) requestAnimationFrame(() => engine?.fitSite());
  });

  // ออกจากเต็มจอด้วยปุ่มของเบราว์เซอร์ = ออกจากโหมด TV ด้วย
  $effect(() => {
    const onFs = () => {
      if (!document.fullscreenElement && app.tvMode) app.tvMode = false;
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  });

  let open = $derived(
    app.site.incidents
      .filter((i) => i.resolvedAt === null)
      .sort((a, b) => Number(a.ackAt !== null) - Number(b.ackAt !== null) || a.openedAt - b.openedAt)
  );
  let kpis = $derived(computeKpis(app.site, 'site', 'day', clock.now));
  let counts = $derived(
    app.site.andonStates.map((s) => ({ s, n: app.site.assets.filter((a) => a.andon && a.status === s.id).length }))
  );
  const stateOf = (id: string) => app.site.andonStates.find((s) => s.id === id);
  const assetName = (id: string) => app.site.assets.find((a) => a.id === id)?.name ?? '(ถูกลบ)';
  const lineName = (id: string | null) => app.site.lines.find((l) => l.id === id)?.name;
  let time = $derived(new Date(clock.now).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  let date = $derived(new Date(clock.now).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
</script>

{#if app.tvMode}
  <header class="tvbar">
    <div class="brand"><span class="logo">iii</span>Map</div>
    <div class="site">{app.site.name}</div>
    <div class="counts">
      {#each counts as c (c.s.id)}
        <span class="cnt" style="--c:{c.s.color}" title={c.s.name}><i></i>{c.s.name} <b>{c.n}</b></span>
      {/each}
    </div>
    <div class="kpis">
      {#each kpis.items.slice(0, 3) as it (it.kpi.id)}
        <span class="kpi {it.state}">{it.kpi.name} <b>{fmtNum(it.value)}</b> <small>{it.kpi.unit}</small></span>
      {/each}
    </div>
    <div class="clock"><b>{time}</b><small>{date}</small></div>
    <button class="exit" onclick={() => actions.exitTv()} title="ออกจากโหมดจอ TV (Esc)">ออก ✕</button>
  </header>

  <aside class="tvlist">
    <h3>เรื่องที่เปิดอยู่ <span class:alert={open.length > 0}>{open.length}</span></h3>
    {#if open.length === 0}
      <p class="ok">✓ ทุกเครื่องปกติ</p>
    {/if}
    {#each open as inc (inc.id)}
      {@const st = stateOf(inc.stateId)}
      {@const stage = stageOf(inc)}
      <div class="item {stage}" style="--c:{st?.color ?? '#94a3b8'}">
        <div class="r1"><b>{assetName(inc.assetId)}</b><span class="t">{fmtDuration(clock.now - inc.openedAt)}</span></div>
        <div class="r2"><i></i>{st?.name ?? inc.stateId}{#if lineName(inc.lineId)} · {lineName(inc.lineId)}{/if}</div>
        <div class="r3">{STAGE_LABEL[stage]}</div>
      </div>
    {/each}
  </aside>
{/if}

<style>
  .tvbar {
    position: absolute; top: 0; left: 0; right: 0; z-index: 8; height: 64px; display: flex; align-items: center; gap: 20px;
    padding: 0 20px; background: rgba(255, 255, 255, 0.96); border-bottom: 1px solid #e5e7eb; font-family: system-ui, sans-serif;
    box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06);
  }
  .brand { font: 700 22px system-ui, sans-serif; color: #0f172a; }
  .logo { color: #2563eb; }
  .site { font-size: 18px; font-weight: 600; color: #334155; padding-left: 16px; border-left: 1px solid #e2e8f0; white-space: nowrap; }
  .counts { display: flex; gap: 12px; flex-wrap: wrap; flex: 1; }
  .cnt { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #334155; white-space: nowrap; }
  .cnt i { width: 12px; height: 12px; border-radius: 50%; background: var(--c); }
  .cnt b { font-size: 18px; color: #0f172a; }
  .kpis { display: flex; gap: 14px; }
  .kpi { font-size: 14px; color: #475569; white-space: nowrap; padding-left: 8px; border-left: 3px solid #cbd5e1; }
  .kpi.good { border-left-color: #16a34a; }
  .kpi.bad { border-left-color: #dc2626; }
  .kpi b { font-size: 18px; color: #0f172a; }
  .kpi.bad b { color: #dc2626; }
  .kpi small { color: #94a3b8; }
  .clock { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.15; }
  .clock b { font: 700 22px ui-monospace, monospace; color: #0f172a; }
  .clock small { font-size: 11.5px; color: #64748b; }
  .exit { border: 1px solid #e2e8f0; background: #fff; border-radius: 8px; padding: 6px 12px; font: 600 13px system-ui, sans-serif; color: #475569; cursor: pointer; }
  .exit:hover { background: #f8fafc; }

  .tvlist {
    position: absolute; top: 80px; right: 16px; bottom: 16px; width: 320px; z-index: 8; overflow-y: auto;
    display: flex; flex-direction: column; gap: 8px; padding: 14px; box-sizing: border-box;
    background: rgba(255, 255, 255, 0.95); border: 1px solid #e5e7eb; border-radius: 14px; font-family: system-ui, sans-serif;
  }
  h3 { margin: 0 0 4px; font-size: 18px; color: #0f172a; display: flex; align-items: center; gap: 8px; }
  h3 span { font-size: 15px; background: #f1f5f9; color: #475569; border-radius: 999px; padding: 1px 10px; }
  h3 span.alert { background: #dc2626; color: #fff; }
  .ok { margin: 8px 0; font-size: 16px; color: #16a34a; font-weight: 600; }
  .item { border-left: 6px solid var(--c); border-radius: 10px; padding: 10px 12px; background: #f8fafc; }
  .item.open { background: color-mix(in srgb, var(--c) 10%, white); animation: pulse 1.2s infinite; }
  @keyframes pulse { 50% { background: #fff; } }
  .r1 { display: flex; justify-content: space-between; align-items: baseline; }
  .r1 b { font-size: 20px; color: #0f172a; }
  .t { font: 700 20px ui-monospace, monospace; color: #0f172a; }
  .r2 { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #334155; margin-top: 2px; }
  .r2 i { width: 10px; height: 10px; border-radius: 50%; background: var(--c); }
  .r3 { font-size: 12.5px; color: #64748b; margin-top: 2px; }
</style>
