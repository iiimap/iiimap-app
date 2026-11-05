<script lang="ts">
  // โหมดจอ TV: ใช้ธีมขาวแบบปกติ ตัวเลขใหญ่ อ่านจากไกลชัด
  // - แถบบน (ชื่อ + นาฬิกา) แสดงเสมอ / แถวการ์ดสถานะและ KPI ย่อเก็บได้ด้วยลูกศร
  // - การ์ดสถานะกับ KPI แบ่งครึ่ง เลื่อนซ้าย-ขวาแยกกันของใครของมัน
  // - รายการ ปัญหาที่ยังไม่ถูกแก้ไข (ด้านขวา) ปิด/เปิดได้ ตอนปิดมีตัวเลขแจ้งเตือนสีแดง
  // - กดรายการ (ทั้งบล็อก) = กล้องพาไปที่เครื่องนั้น + ป๊อปอัปรายละเอียดบนผัง
  import type { MapEngine } from '../map-engine/MapEngine';
  import { app, actions, clock } from '../stores/site.svelte';
  import { computeKpis, fmtNum } from '../domain/kpi';
  import { stageOf, STAGE_LABEL, fmtDuration } from '../domain/incident';
  import ScrollStrip from './ScrollStrip.svelte';

  let { engine }: { engine?: MapEngine } = $props();

  const BAR = 56; // แถบบน (px)
  const STATS = 112; // แถวการ์ด (px)
  const SIDE = 360; // ความกว้างรายการด้านขวา + ระยะขอบ (px)

  // จำว่าย่อ/ขยายส่วนไหนไว้ (ต่อเครื่อง)
  function load(key: string, def: boolean) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? def : v === '1';
    } catch {
      return def;
    }
  }
  let topOpen = $state(load('iiimap.tv.top', true)); // แถวการ์ดสถานะ/KPI
  let sideOpen = $state(load('iiimap.tv.side', true));
  $effect(() => {
    try {
      localStorage.setItem('iiimap.tv.top', topOpen ? '1' : '0');
      localStorage.setItem('iiimap.tv.side', sideOpen ? '1' : '0');
    } catch {
      /* ไม่จำก็ไม่เป็นไร */
    }
  });

  // ซูมให้ผังพอดีพื้นที่ว่าง (ทำใหม่ทุกครั้งที่ย่อ/ขยายแถบ)
  $effect(() => {
    if (!app.tvMode) return;
    const top = BAR + (topOpen ? STATS : 0);
    const side = sideOpen ? SIDE : 0;
    const t = setTimeout(() => engine?.fitSite(top, side), 120); // รอเต็มจอ/แอนิเมชันเสร็จก่อน
    return () => clearTimeout(t);
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

  // ---------- กดชื่อเครื่อง = ไปที่เครื่องนั้น + ป๊อปอัป ----------
  let focusId = $state<string | null>(null); // id ของเรื่องที่ป๊อปอัปอยู่
  let popPos = $state({ x: -9999, y: -9999 }); // ตำแหน่งบนจอ (อัปเดตทุกเฟรม แยกจาก focusId)
  let focusInc = $derived(focusId ? app.site.incidents.find((i) => i.id === focusId) : undefined);

  function goTo(incId: string) {
    // กดบล็อกเดิมซ้ำ = ปิดป๊อปอัป
    if (focusId === incId) {
      focusId = null;
      return;
    }
    const inc = app.site.incidents.find((i) => i.id === incId);
    const a = inc && app.site.assets.find((x) => x.id === inc.assetId);
    if (!inc || !a || !engine) return;
    const top = BAR + (topOpen ? STATS : 0);
    const side = sideOpen ? SIDE : 0;
    // ให้เครื่องอยู่กลางพื้นที่ว่าง (ไม่โดนแถบบนและรายการขวาบัง) และซูมเข้าให้เห็นชัด
    engine.flyTo(a.x, a.z, -side / 2, top / 2, Math.max(engine.getZoom(), 1.8));
    popPos = { x: -9999, y: -9999 };
    focusId = incId;
  }

  // ตามตำแหน่งเครื่องทุกเฟรม ระหว่างที่ป๊อปอัปเปิดอยู่
  $effect(() => {
    const id = focusId;
    if (!id || !engine) return;
    let raf = 0;
    const tick = () => {
      const inc = app.site.incidents.find((i) => i.id === id);
      const p = inc ? engine!.getLabelAnchor(inc.assetId) : null;
      if (p) popPos = p;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  });

  // ปิดป๊อปอัปอัตโนมัติเมื่อครบ 20 วินาที
  $effect(() => {
    if (!focusId) return;
    const t = setTimeout(() => (focusId = null), 20000);
    return () => clearTimeout(t);
  });
  // เรื่องถูกปิดไปแล้ว = ปิดป๊อปอัป
  $effect(() => {
    if (focusId && (!focusInc || focusInc.resolvedAt !== null)) focusId = null;
  });
  // คลิกที่อื่น = ปิดป๊อปอัป
  function onOutside(e: PointerEvent) {
    if (focusId && !(e.target as HTMLElement).closest('.pop, .row')) focusId = null;
  }

  const stateOf = (id: string) => app.site.andonStates.find((s) => s.id === id);
  const assetName = (id: string) => app.site.assets.find((a) => a.id === id)?.name ?? '(ถูกลบ)';
  const lineName = (id: string | null) => app.site.lines.find((l) => l.id === id)?.name;
  let time = $derived(new Date(clock.now).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  let date = $derived(new Date(clock.now).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
</script>

{#snippet chevron(dir: 'up' | 'down' | 'left' | 'right' | 'x', size = 18)}
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d={{ up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6', left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6', x: 'M6 6l12 12 M18 6L6 18' }[dir]} />
  </svg>
{/snippet}

<svelte:window onpointerdown={onOutside} />

{#if app.tvMode}
  <div class="tv">
    <header class="bar">
      <div class="brand"><span class="logo">iii</span>Map</div>
      <div class="site">{app.site.name}</div>
      <div class="spacer"></div>
      <div class="clock"><b>{time}</b><small>{date}</small></div>
      <button class="exit" onclick={() => actions.exitTv()} title="ออกจากโหมดจอ TV (Esc)">ออก</button>
    </header>

    {#if topOpen}
      <section class="stats">
        <ScrollStrip title="สถานะเครื่อง">
          {#each counts as c (c.s.id)}
            <div class="tile st" style="--c:{c.s.color}">
              <span class="name"><i></i>{c.s.name}</span>
              <b>{c.n}</b>
            </div>
          {/each}
        </ScrollStrip>
        <span class="divider"></span>
        <ScrollStrip title="KPI · วันนี้">
          {#each kpis.items as it (it.kpi.id)}
            <div class="tile k {it.state}">
              <span class="name">{it.kpi.name}</span>
              <b>{fmtNum(it.value)}<small>{it.kpi.unit}</small></b>
            </div>
          {:else}
            <span class="none">ยังไม่มี KPI</span>
          {/each}
        </ScrollStrip>
        <button class="collapse" title="ย่อแถวสถานะและ KPI" aria-label="ย่อแถวสถานะและ KPI" onclick={() => (topOpen = false)}>{@render chevron('up')}</button>
      </section>
    {:else}
      <button class="pull top" title="แสดงแถวสถานะและ KPI" aria-label="แสดงแถวสถานะและ KPI" onclick={() => (topOpen = true)}>
        {@render chevron('down')}<span>สถานะ · KPI</span>
      </button>
    {/if}

    {#if sideOpen}
      <aside class="list" class:full={!topOpen}>
        <h3>
          ปัญหาที่ยังไม่ถูกแก้ไข
          <span class="n" class:alert={open.length > 0}>{open.length}</span>
          {#if waiting}<span class="wait">รอรับเรื่อง {waiting}</span>{/if}
          <button class="hide" title="ซ่อนรายการ" aria-label="ซ่อนรายการ" onclick={() => (sideOpen = false)}>{@render chevron('right')}</button>
        </h3>
        {#if open.length === 0}
          <p class="allok">✓ ทุกเครื่องทำงานปกติ</p>
        {/if}
        <div class="rows">
          {#each open as inc (inc.id)}
            {@const st = stateOf(inc.stateId)}
            {@const stage = stageOf(inc)}
            <button class="row" class:on={focusId === inc.id} style="--c:{st?.color ?? '#94a3b8'}" title="ไปที่เครื่องนี้บนผัง" onclick={() => goTo(inc.id)}>
              <span class="main">
                <b class="name">{assetName(inc.assetId)}</b>
                <span>{st?.name ?? inc.stateId}{#if lineName(inc.lineId)} · {lineName(inc.lineId)}{/if}</span>
              </span>
              <span class="side">
                <span class="t">{fmtDuration(clock.now - inc.openedAt)}</span>
                <span class="stage {stage}">{#if stage === 'open'}<i></i>{/if}{STAGE_LABEL[stage]}</span>
              </span>
            </button>
          {/each}
        </div>
      </aside>
    {:else}
      <button class="pull side" class:full={!topOpen} title="แสดง ปัญหาที่ยังไม่ถูกแก้ไข" aria-label="แสดง ปัญหาที่ยังไม่ถูกแก้ไข {open.length} รายการ" onclick={() => (sideOpen = true)}>
        {@render chevron('left')}
        <span class="vt">ปัญหาที่ยังไม่ถูกแก้ไข</span>
        {#if open.length}<span class="badge">{open.length}</span>{/if}
      </button>
    {/if}

    {#if focusId && focusInc}
      {@const st = stateOf(focusInc.stateId)}
      {@const stage = stageOf(focusInc)}
      <div class="pop" style="left:{popPos.x}px; top:{popPos.y}px; --c:{st?.color ?? '#94a3b8'}">
        <div class="ph">
          <b>{assetName(focusInc.assetId)}</b>
          <button class="px" aria-label="ปิด" onclick={() => (focusId = null)}>{@render chevron('x', 14)}</button>
        </div>
        <div class="pst"><i></i>{st?.name ?? focusInc.stateId}{#if lineName(focusInc.lineId)} · {lineName(focusInc.lineId)}{/if}</div>
        <div class="pt">{fmtDuration(clock.now - focusInc.openedAt)}</div>
        <div class="pstage {stage}">{STAGE_LABEL[stage]}</div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .tv { position: absolute; inset: 0; z-index: 8; pointer-events: none; font-family: system-ui, sans-serif; color: #0f172a; }
  .tv > * { pointer-events: auto; }

  /* แถบบน */
  .bar {
    position: absolute; top: 0; left: 0; right: 0; height: 56px; display: flex; align-items: center; gap: 18px;
    padding: 0 24px; background: #ffffff; border-bottom: 1px solid #e5e7eb; box-sizing: border-box;
  }
  .brand { font: 700 22px system-ui, sans-serif; color: #0f172a; }
  .logo { color: #2563eb; }
  .site { font-size: 18px; font-weight: 600; color: #334155; padding-left: 18px; border-left: 1px solid #e2e8f0; white-space: nowrap; }
  .spacer { flex: 1; }
  .clock { display: flex; align-items: baseline; gap: 12px; white-space: nowrap; }
  .clock b { font: 700 24px ui-monospace, monospace; color: #0f172a; }
  .clock small { font-size: 13px; color: #64748b; }
  .exit {
    border: 1px solid #e2e8f0; background: #fff; color: #64748b; border-radius: 8px; padding: 6px 14px;
    font: 600 13px system-ui, sans-serif; cursor: pointer;
  }
  .exit:hover { color: #0f172a; background: #f8fafc; }

  /* แถวการ์ด: ซ้าย = สถานะ / ขวา = KPI (เลื่อนแยกกัน) */
  .stats {
    position: absolute; top: 56px; left: 0; right: 0; height: 112px; box-sizing: border-box; display: flex; gap: 20px;
    padding: 8px 24px 12px; background: #f8fafc; border-bottom: 1px solid #e5e7eb;
  }
  .none { align-self: center; font-size: 13px; color: #94a3b8; }
  .tile {
    flex: none; min-width: 130px; padding: 8px 14px; border-radius: 10px; background: #ffffff; border: 1px solid #e5e7eb;
    display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  }
  .tile .name { display: flex; align-items: center; gap: 7px; font-size: 13px; color: #64748b; white-space: nowrap; }
  .tile .name i { width: 10px; height: 10px; border-radius: 50%; background: var(--c); }
  .tile b { font: 700 32px system-ui, sans-serif; color: #0f172a; line-height: 1; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .st { border-top: 3px solid var(--c); }
  .k { min-width: 160px; border-top: 3px solid #cbd5e1; }
  .k.good { border-top-color: #16a34a; }
  .k.bad { border-top-color: #dc2626; }
  .k.bad b { color: #dc2626; }
  .k b small { font-size: 13px; font-weight: 500; color: #94a3b8; margin-left: 6px; }
  .divider { flex: none; width: 1px; margin: 18px 0 0; background: #e5e7eb; }

  /* ปุ่มย่อ/ขยาย */
  .collapse, .pull.top {
    position: absolute; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; padding: 0 14px;
    height: 24px; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 10px 10px; background: #f8fafc;
    color: #64748b; cursor: pointer; font: 600 12px system-ui, sans-serif;
  }
  .collapse { bottom: -24px; }
  .pull.top { top: 56px; height: 26px; background: #fff; }
  .collapse:hover, .pull:hover { color: #0f172a; }

  /* รายการ ปัญหาที่ยังไม่ถูกแก้ไข (ขวา) */
  .list {
    position: absolute; top: 184px; right: 16px; bottom: 16px; width: 330px; box-sizing: border-box;
    display: flex; flex-direction: column; padding: 16px; background: rgba(255, 255, 255, 0.97);
    border: 1px solid #e5e7eb; border-radius: 14px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  }
  .list.full { top: 96px; }
  h3 { margin: 0 0 12px; display: flex; align-items: center; gap: 8px; font-size: 17px; color: #0f172a; }
  .n { font-size: 15px; background: #f1f5f9; color: #475569; border-radius: 999px; padding: 1px 10px; }
  .n.alert { background: #dc2626; color: #fff; }
  .wait { margin-left: auto; font-size: 12px; font-weight: 500; color: #dc2626; }
  .hide {
    margin-left: auto; width: 30px; height: 30px; display: grid; place-items: center; padding: 0; border-radius: 8px;
    border: 1px solid #e2e8f0; background: #fff; color: #64748b; cursor: pointer;
  }
  .wait + .hide { margin-left: 4px; }
  .hide:hover { color: #0f172a; background: #f8fafc; }
  .allok { margin: 8px 0; font-size: 18px; color: #16a34a; font-weight: 600; }
  .rows { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
  .row {
    display: flex; justify-content: space-between; gap: 10px; padding: 10px 12px 10px 14px; border-radius: 10px;
    background: #ffffff; border: 1px solid #e5e7eb; border-left: 5px solid var(--c);
    width: 100%; text-align: left; cursor: pointer; font-family: system-ui, sans-serif; color: inherit;
    transition: background 0.12s, border-color 0.12s, box-shadow 0.12s;
  }
  .row:hover { background: #f8fafc; border-color: #cbd5e1; border-left-color: var(--c); box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08); }
  .row.on { background: #eff6ff; border-color: #93c5fd; border-left-color: var(--c); }
  .main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .main .name { font: 700 19px system-ui, sans-serif; color: #0f172a; }
  .main span { font-size: 13px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .t { font: 700 19px ui-monospace, monospace; color: #0f172a; }
  .stage { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b; white-space: nowrap; }
  .stage.open { color: #dc2626; font-weight: 600; }
  .stage i { width: 8px; height: 8px; border-radius: 50%; background: #dc2626; animation: blink 1s infinite; }
  @keyframes blink { 50% { opacity: 0.2; } }

  /* แถบดึงรายการกลับ (ตอนซ่อน) */
  .pull.side {
    position: absolute; top: 184px; right: 0; display: flex; flex-direction: column; align-items: center; gap: 10px;
    padding: 12px 8px; border: 1px solid #e5e7eb; border-right: 0; border-radius: 12px 0 0 12px;
    background: #ffffff; color: #64748b; cursor: pointer; font: 600 13px system-ui, sans-serif;
    box-shadow: -4px 4px 16px rgba(15, 23, 42, 0.08);
  }
  .pull.side.full { top: 96px; }
  .vt { writing-mode: vertical-rl; letter-spacing: 0.02em; }
  .badge {
    min-width: 26px; height: 26px; padding: 0 6px; box-sizing: border-box; border-radius: 999px; display: grid; place-items: center;
    background: #dc2626; color: #fff; font: 700 14px system-ui, sans-serif; animation: pop 1.6s infinite;
  }
  @keyframes pop { 0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.5); } 50% { box-shadow: 0 0 0 8px rgba(220, 38, 38, 0); } }

  /* ป๊อปอัปบนผัง */
  .pop {
    position: absolute; transform: translate(-50%, calc(-100% - 14px)); min-width: 190px; padding: 12px 14px; box-sizing: border-box;
    border-radius: 12px; background: #ffffff; border: 1px solid #e2e8f0; border-top: 4px solid var(--c);
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18); display: flex; flex-direction: column; gap: 4px;
  }
  .pop::after {
    content: ''; position: absolute; left: 50%; bottom: -8px; transform: translateX(-50%) rotate(45deg);
    width: 14px; height: 14px; background: #ffffff; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;
  }
  .ph { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .ph b { font-size: 20px; color: #0f172a; }
  .px { width: 24px; height: 24px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 6px; background: transparent; color: #94a3b8; cursor: pointer; }
  .px:hover { background: #f1f5f9; color: #0f172a; }
  .pst { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #334155; }
  .pst i { width: 10px; height: 10px; border-radius: 50%; background: var(--c); }
  .pt { font: 700 26px ui-monospace, monospace; color: #0f172a; }
  .pstage { font-size: 12.5px; color: #64748b; }
  .pstage.open { color: #dc2626; font-weight: 600; }
</style>
