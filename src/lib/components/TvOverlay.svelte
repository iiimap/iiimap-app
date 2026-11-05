<script lang="ts">
  // โหมดจอ TV (แบบห้องควบคุม): ธีมมืด ตัวเลขใหญ่ อ่านจากไกลชัด
  // บน: ชื่อโรงงาน + นาฬิกา / แถวสรุป: จำนวนเครื่องตามสถานะ + KPI (เกิน 4 ตัวจะวนแสดงทีละหน้า)
  // ขวา: เรื่อง Andon ที่เปิดอยู่
  import type { MapEngine } from '../map-engine/MapEngine';
  import { app, actions, clock } from '../stores/site.svelte';
  import { computeKpis, fmtNum } from '../domain/kpi';
  import { stageOf, STAGE_LABEL, fmtDuration } from '../domain/incident';

  let { engine }: { engine?: MapEngine } = $props();

  const TOP = 56 + 104; // ความสูงแถบบน + แถวสรุป (px)
  const SIDE = 360; // ความกว้างรายการด้านขวา + ระยะขอบ (px)
  const KPI_PER_PAGE = 4;
  const KPI_PAGE_MS = 8000;

  // เข้า/ออกโหมด TV: สลับธีมผัง และซูมให้ผังพอดีพื้นที่ว่าง
  $effect(() => {
    engine?.setDark(app.tvMode);
    if (app.tvMode) {
      const t = setTimeout(() => engine?.fitSite(TOP, SIDE), 120); // รอเต็มจอเสร็จก่อน
      return () => clearTimeout(t);
    }
  });

  // ออกจากเต็มจอด้วยปุ่มของเบราว์เซอร์ = ออกจากโหมด TV ด้วย
  $effect(() => {
    const onFs = () => {
      if (!document.fullscreenElement && app.tvMode) actions.exitTv();
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  });

  let open = $derived(
    app.site.incidents
      .filter((i) => i.resolvedAt === null)
      .sort((a, b) => Number(a.ackAt !== null) - Number(b.ackAt !== null) || a.openedAt - b.openedAt)
  );
  let waiting = $derived(open.filter((i) => i.ackAt === null).length);
  let kpis = $derived(computeKpis(app.site, 'site', 'day', clock.now));
  let counts = $derived(
    app.site.andonStates.map((s) => ({ s, n: app.site.assets.filter((a) => a.andon && a.status === s.id).length }))
  );

  // KPI วนแสดงทีละหน้า (กันแถบรกเมื่อมี KPI เยอะ)
  let pages = $derived(Math.max(1, Math.ceil(kpis.items.length / KPI_PER_PAGE)));
  let page = $derived(Math.floor(clock.now / KPI_PAGE_MS) % pages);
  let shownKpis = $derived(kpis.items.slice(page * KPI_PER_PAGE, page * KPI_PER_PAGE + KPI_PER_PAGE));

  const stateOf = (id: string) => app.site.andonStates.find((s) => s.id === id);
  const assetName = (id: string) => app.site.assets.find((a) => a.id === id)?.name ?? '(ถูกลบ)';
  const lineName = (id: string | null) => app.site.lines.find((l) => l.id === id)?.name;
  let time = $derived(new Date(clock.now).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  let date = $derived(new Date(clock.now).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
</script>

{#if app.tvMode}
  <div class="tv">
    <header class="bar">
      <div class="brand"><span class="logo">iii</span>Map</div>
      <div class="site">{app.site.name}</div>
      <div class="spacer"></div>
      <div class="clock"><b>{time}</b><small>{date}</small></div>
      <button class="exit" onclick={() => actions.exitTv()} title="ออกจากโหมดจอ TV (Esc)">ออก</button>
    </header>

    <section class="stats">
      <div class="group status">
        {#each counts as c (c.s.id)}
          <div class="tile" style="--c:{c.s.color}">
            <span class="name"><i></i>{c.s.name}</span>
            <b>{c.n}</b>
          </div>
        {/each}
      </div>
      {#if kpis.items.length}
        <div class="group kpi">
          {#each shownKpis as it (it.kpi.id)}
            <div class="tile k {it.state}">
              <span class="name">{it.kpi.name} <small>วันนี้</small></span>
              <b>{fmtNum(it.value)}<small>{it.kpi.unit}</small></b>
            </div>
          {/each}
          {#if pages > 1}
            <div class="dots">
              {#each Array(pages) as _, i}<i class:on={i === page}></i>{/each}
            </div>
          {/if}
        </div>
      {/if}
    </section>

    <aside class="list">
      <h3>
        เรื่องที่เปิดอยู่
        <span class="n" class:alert={open.length > 0}>{open.length}</span>
        {#if waiting}<span class="wait">รอรับเรื่อง {waiting}</span>{/if}
      </h3>
      {#if open.length === 0}
        <p class="allok">✓ ทุกเครื่องทำงานปกติ</p>
      {/if}
      <div class="rows">
        {#each open as inc (inc.id)}
          {@const st = stateOf(inc.stateId)}
          {@const stage = stageOf(inc)}
          <div class="row" style="--c:{st?.color ?? '#94a3b8'}">
            <div class="main">
              <b>{assetName(inc.assetId)}</b>
              <span>{st?.name ?? inc.stateId}{#if lineName(inc.lineId)} · {lineName(inc.lineId)}{/if}</span>
            </div>
            <div class="side">
              <span class="t">{fmtDuration(clock.now - inc.openedAt)}</span>
              <span class="stage {stage}">{#if stage === 'open'}<i></i>{/if}{STAGE_LABEL[stage]}</span>
            </div>
          </div>
        {/each}
      </div>
    </aside>
  </div>
{/if}

<style>
  .tv { position: absolute; inset: 0; z-index: 8; pointer-events: none; font-family: system-ui, sans-serif; color: #e2e8f0; }
  .tv > * { pointer-events: auto; }

  /* แถบบน */
  .bar {
    position: absolute; top: 0; left: 0; right: 0; height: 56px; display: flex; align-items: center; gap: 18px;
    padding: 0 24px; background: #0b1220; border-bottom: 1px solid #1e293b;
  }
  .brand { font: 700 22px system-ui, sans-serif; color: #f8fafc; }
  .logo { color: #60a5fa; }
  .site { font-size: 18px; font-weight: 600; color: #cbd5e1; padding-left: 18px; border-left: 1px solid #334155; }
  .spacer { flex: 1; }
  .clock { display: flex; align-items: baseline; gap: 12px; }
  .clock b { font: 700 24px ui-monospace, monospace; color: #f8fafc; }
  .clock small { font-size: 13px; color: #94a3b8; }
  .exit {
    border: 1px solid #334155; background: transparent; color: #94a3b8; border-radius: 8px; padding: 6px 14px;
    font: 600 13px system-ui, sans-serif; cursor: pointer; opacity: 0.6;
  }
  .exit:hover { opacity: 1; color: #f8fafc; }

  /* แถวสรุป */
  .stats {
    position: absolute; top: 56px; left: 0; right: 0; height: 104px; box-sizing: border-box; display: flex; gap: 24px;
    align-items: center; padding: 12px 24px; background: #0f172a; border-bottom: 1px solid #1e293b; overflow: hidden;
  }
  .group { display: flex; gap: 10px; align-items: stretch; height: 100%; }
  .group.kpi { margin-left: auto; padding-left: 24px; border-left: 1px solid #1e293b; position: relative; }
  .tile {
    min-width: 120px; padding: 8px 14px; border-radius: 10px; background: #111c31; border: 1px solid #1e293b;
    display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;
  }
  .tile .name { display: flex; align-items: center; gap: 7px; font-size: 13px; color: #94a3b8; white-space: nowrap; }
  .tile .name i { width: 10px; height: 10px; border-radius: 50%; background: var(--c); }
  .tile b { font: 700 32px system-ui, sans-serif; color: #f8fafc; line-height: 1; font-variant-numeric: tabular-nums; }
  .status .tile { border-top: 3px solid var(--c); }
  .k { min-width: 150px; border-top: 3px solid #475569; }
  .k.good { border-top-color: #22c55e; }
  .k.bad { border-top-color: #ef4444; }
  .k.bad b { color: #fca5a5; }
  .k b small { font-size: 13px; font-weight: 500; color: #94a3b8; margin-left: 6px; }
  .k .name small { font-size: 11px; color: #64748b; }
  .dots { position: absolute; bottom: -8px; right: 0; display: flex; gap: 4px; }
  .dots i { width: 6px; height: 6px; border-radius: 50%; background: #334155; }
  .dots i.on { background: #94a3b8; }

  /* รายการเรื่องด้านขวา */
  .list {
    position: absolute; top: 176px; right: 16px; bottom: 16px; width: 330px; box-sizing: border-box;
    display: flex; flex-direction: column; padding: 16px; background: rgba(15, 23, 42, 0.92);
    border: 1px solid #1e293b; border-radius: 14px;
  }
  h3 { margin: 0 0 12px; display: flex; align-items: center; gap: 8px; font-size: 17px; color: #f8fafc; }
  .n { font-size: 15px; background: #1e293b; color: #cbd5e1; border-radius: 999px; padding: 1px 10px; }
  .n.alert { background: #dc2626; color: #fff; }
  .wait { margin-left: auto; font-size: 12px; font-weight: 500; color: #fca5a5; }
  .allok { margin: 8px 0; font-size: 18px; color: #4ade80; font-weight: 600; }
  .rows { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
  .row {
    display: flex; justify-content: space-between; gap: 10px; padding: 10px 12px 10px 14px; border-radius: 10px;
    background: #111c31; border: 1px solid #1e293b; border-left: 5px solid var(--c);
  }
  .main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .main b { font-size: 19px; color: #f8fafc; }
  .main span { font-size: 13px; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .t { font: 700 19px ui-monospace, monospace; color: #f8fafc; }
  .stage { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #94a3b8; white-space: nowrap; }
  .stage.open { color: #fca5a5; font-weight: 600; }
  .stage i { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; animation: blink 1s infinite; }
  @keyframes blink { 50% { opacity: 0.2; } }
</style>
