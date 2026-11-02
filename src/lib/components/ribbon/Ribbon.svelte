<script lang="ts">
  import { onMount } from 'svelte';
  import type { MapEngine } from '../../map-engine/MapEngine';
  import { getThumbnails } from '../../map-engine/thumbnails';
  import { CATEGORIES, MODELS } from '../../domain/catalog';
  import { app, actions, history, clip } from '../../stores/site.svelte';
  import FileMenu from '../FileMenu.svelte';
  import RButton from './RButton.svelte';
  import RGroup from './RGroup.svelte';
  import Icon from './Icon.svelte';
  import ModelGallery from './ModelGallery.svelte';
  import type { CategoryId } from '../../domain/catalog';

  let { engine }: { engine?: MapEngine } = $props();

  const VERSION = 'v0.16';
  const SAVE_TEXT = { saved: 'บันทึกแล้ว', saving: 'กำลังบันทึก…', error: 'บันทึกไม่สำเร็จ' };

  const TABS = [
    { id: 'home', label: 'หน้าแรก', edit: true },
    { id: 'insert', label: 'แทรก', edit: true },
    { id: 'line', label: 'Line', edit: false },
    { id: 'andon', label: 'Andon', edit: false },
    { id: 'view', label: 'มุมมอง', edit: false }
  ] as const;

  let tabs = $derived(TABS.filter((t) => app.mode === 'edit' || !t.edit));
  let editing = $derived(app.mode === 'edit');
  let hasSel = $derived(!!app.selectedId);

  // จำนวนเครื่องในแต่ละไลน์ / แต่ละสถานะ (แสดงบน Ribbon)
  let lineCount = $derived(
    app.site.assets.reduce((m, a) => (a.lineId && (m[a.lineId] = (m[a.lineId] ?? 0) + 1), m), {} as Record<string, number>)
  );
  let stateCount = $derived(
    app.site.assets.reduce((m, a) => (a.andon && (m[a.status] = (m[a.status] ?? 0) + 1), m), {} as Record<string, number>)
  );

  let thumbs = $state<Record<string, string>>({});
  onMount(() => {
    thumbs = getThumbnails();
  });

  // รูปแทนหมวด = โมเดลตัวแรกของหมวด
  const categoryCover = Object.fromEntries(
    CATEGORIES.map((c) => [c.id, Object.values(MODELS).find((m) => m.category === c.id)?.id ?? ''])
  ) as Record<CategoryId, string>;

  // แกลเลอรีที่เปิดอยู่ (หมวด หรือ 'all' = ทั้งหมด)
  let gallery = $state<{ category: CategoryId | null; anchor: DOMRect } | null>(null);

  function openGallery(e: MouseEvent, category: CategoryId | null) {
    const anchor = (e.currentTarget as HTMLElement).getBoundingClientRect();
    gallery = gallery && gallery.category === category ? null : { category, anchor };
  }
</script>

<header class="ribbon">
  <!-- แถบชื่อ -->
  <div class="titlebar">
    <div class="brand"><span class="logo">iii</span>Map</div>
    <span class="divider"></span>
    <span class="doc">{app.site.name}</span>
    <span class="save {app.saveState}">{SAVE_TEXT[app.saveState]}</span>
    <span class="spacer"></span>
    <span class="ver">{VERSION}</span>
    <div class="mode" role="group" aria-label="โหมด">
      <button class:on={app.mode === 'view'} onclick={() => actions.setMode('view')}>
        <Icon name="eye" size={15} /> ดูผัง
      </button>
      <button class:on={app.mode === 'edit'} onclick={() => actions.setMode('edit')}>
        <Icon name="edit" size={15} /> แก้ไขผัง
      </button>
    </div>
  </div>

  <!-- แท็บ -->
  <nav class="tabs">
    <FileMenu />
    {#each tabs as t}
      <button class="tab" class:on={app.ribbonTab === t.id} onclick={() => actions.setTab(t.id)}>
        {t.label}
      </button>
    {/each}
  </nav>

  <!-- เนื้อหาแท็บ -->
  <div class="body">
    {#if app.ribbonTab === 'home' && editing}
      <RGroup label="คลิปบอร์ด">
        <RButton size="large" icon="paste" label="วาง" title="วาง (Ctrl+V)" disabled={!clip.has} onclick={() => actions.paste()} />
        <div class="stack">
          <RButton icon="cut" label="ตัด" title="ตัด (Ctrl+X)" disabled={!hasSel} onclick={() => actions.cut()} />
          <RButton icon="copy" label="คัดลอก" title="คัดลอก (Ctrl+C)" disabled={!hasSel} onclick={() => actions.copy()} />
        </div>
      </RGroup>
      <RGroup label="ประวัติ">
        <RButton size="large" icon="undo" label="ย้อนกลับ" title="ย้อนกลับ (Ctrl+Z)" disabled={history.past.length === 0} onclick={() => actions.undo()} />
        <RButton size="large" icon="redo" label="ทำซ้ำ" title="ทำซ้ำ (Ctrl+Y)" disabled={history.future.length === 0} onclick={() => actions.redo()} />
      </RGroup>
      <RGroup label="แก้ไข">
        <RButton size="large" icon="rotateCw" label="หมุน 90°" title="หมุน (R)" disabled={!hasSel} onclick={() => app.selectedId && actions.rotate(app.selectedId)} />
        <RButton size="large" icon="trash" label="ลบ" title="ลบ (Delete)" disabled={!hasSel} onclick={() => app.selectedId && actions.remove(app.selectedId)} />
        <div class="stack">
          <RButton icon="deselect" label="ยกเลิกเลือก" title="ยกเลิกเลือก (Esc)" disabled={!hasSel} onclick={() => (app.selectedId = null)} />
        </div>
      </RGroup>
    {:else if app.ribbonTab === 'insert' && editing}
      <RGroup label="โมเดล">
        {#each CATEGORIES as c}
          <button class="cat gallery-trigger" class:open={gallery?.category === c.id} onclick={(e) => openGallery(e, c.id)}>
            {#if thumbs[categoryCover[c.id]]}<img src={thumbs[categoryCover[c.id]]} alt="" />{:else}<span class="ph"></span>{/if}
            <span>{c.label} ▾</span>
          </button>
        {/each}
        <button class="cat gallery-trigger all" class:open={gallery?.category === null} onclick={(e) => openGallery(e, null)}>
          <span class="search">⌕</span>
          <span>ทั้งหมด / ค้นหา ▾</span>
        </button>
      </RGroup>
      {#if app.recent.length}
        <RGroup label="ใช้ล่าสุด">
          {#each app.recent as id}
            {#if MODELS[id]}
              <button class="tile" class:on={app.placing === id} title="{MODELS[id].label} · {MODELS[id].w} × {MODELS[id].d} ม." onclick={() => actions.startPlacing(id)}>
                {#if thumbs[id]}<img src={thumbs[id]} alt="" />{:else}<span class="ph"></span>{/if}
              </button>
            {/if}
          {/each}
        </RGroup>
      {/if}
    {:else if app.ribbonTab === 'line'}
      <RGroup label={app.draftLineId ? 'กำลังสร้างไลน์' : 'ไลน์'}>
        {#if app.draftLineId}
          <RButton size="large" icon="check" label="บันทึก" title="บันทึกไลน์ที่สร้าง" onclick={() => actions.saveDraft()} />
          <RButton size="large" icon="close" label="ยกเลิก" title="ยกเลิกการสร้างไลน์" onclick={() => actions.cancelDraft()} />
        {:else}
          <RButton size="large" icon="zone" label="สร้างไลน์" title="สร้างไลน์ใหม่ ตั้งชื่อ แล้วเลือกเครื่องเข้าไลน์" disabled={!editing} onclick={() => actions.startDraft()} />
        {/if}
      </RGroup>
      <RGroup label="ไลน์ทั้งหมด · กดเพื่อไฮไลต์เครื่องในไลน์">
        {#if app.site.lines.length === 0}
          <span class="none">ยังไม่มีไลน์</span>
        {:else}
          <div class="chips">
            {#each app.site.lines as l (l.id)}
              <button class="chip" class:on={app.activeLineId === l.id} class:draft={app.draftLineId === l.id} style="--c:{l.color}"
                title="{l.name} · {l.mode === 'byLine' ? 'ByLine' : 'ByStation'}"
                onclick={() => { app.activeLineId = app.activeLineId === l.id ? null : l.id; app.lineAddMode = null; }}>
                <i></i><span>{l.name}</span><b>{lineCount[l.id] ?? 0}</b>
              </button>
            {/each}
          </div>
        {/if}
      </RGroup>
      <RGroup label="แสดง">
        <RButton size="large" icon="grid" label="กรอบทุกไลน์" active={app.showLineFrames} onclick={() => (app.showLineFrames = !app.showLineFrames)} />
      </RGroup>
    {:else if app.ribbonTab === 'andon'}
      <RGroup label="สถานะ">
        <RButton size="large" icon="paste" label="เพิ่มสถานะ" disabled={!editing} onclick={() => actions.addAndonState()} />
        <RButton size="large" icon="undo" label="คืนค่าสี" title="คืนสีและชื่อสถานะเริ่มต้น" disabled={!editing} onclick={() => actions.resetAndonStates()} />
      </RGroup>
      <RGroup label="จำนวนเครื่องตามสถานะ (เฉพาะเครื่องที่เปิด Andon)">
        <div class="legend">
          {#each app.site.andonStates as st (st.id)}
            <span title="{st.name}: {stateCount[st.id] ?? 0} เครื่อง"><i style="background:{st.color}"></i>{st.name}<b>{stateCount[st.id] ?? 0}</b></span>
          {/each}
        </div>
      </RGroup>
    {:else}
      <RGroup label="หมุนผัง">
        <RButton size="large" icon="rotateCcw" label="ทวนเข็ม" onclick={() => engine?.rotate(-1)} />
        <RButton size="large" icon="rotateCw" label="ตามเข็ม" onclick={() => engine?.rotate(1)} />
      </RGroup>
      <RGroup label="ซูม">
        <RButton size="large" icon="home" label="มุมเริ่มต้น" onclick={() => engine?.resetView()} />
        <div class="stack">
          <RButton icon="zoomIn" label="ซูมเข้า" onclick={() => engine?.zoomBy(1.25)} />
          <RButton icon="zoomOut" label="ซูมออก" onclick={() => engine?.zoomBy(1 / 1.25)} />
          <span class="zoomtext">{Math.round(app.zoom * 100)}%</span>
        </div>
      </RGroup>
      <RGroup label="แสดง">
        <RButton size="large" icon="grid" label="เส้นกริด" active={app.showGrid} onclick={() => (app.showGrid = !app.showGrid)} />
        <RButton size="large" icon="zone" label="กรอบไลน์" active={app.showLineFrames} onclick={() => (app.showLineFrames = !app.showLineFrames)} />
      </RGroup>
    {/if}
  </div>
</header>

{#if gallery}
  <ModelGallery category={gallery.category} anchor={gallery.anchor} {thumbs} onclose={() => (gallery = null)} />
{/if}

<style>
  .ribbon { background: #ffffff; border-bottom: 1px solid #e5e7eb; font-family: system-ui, sans-serif; flex: none; }

  .titlebar {
    height: 40px; display: flex; align-items: center; gap: 12px; padding: 0 12px 0 16px;
    background: #f8fafc; border-bottom: 1px solid #eef2f6;
  }
  .brand { font-weight: 700; font-size: 16px; color: #0f172a; }
  .logo { color: #2563eb; }
  .divider { width: 1px; height: 18px; background: #e2e8f0; }
  .doc { font-size: 13px; color: #0f172a; font-weight: 500; }
  .save { font-size: 12px; color: #94a3b8; }
  .save.saved::before { content: '✓ '; color: #16a34a; }
  .save.error { color: #dc2626; }
  .spacer { flex: 1; }
  .ver { font-size: 11px; color: #94a3b8; background: #eef2f6; padding: 2px 6px; border-radius: 4px; }
  .mode { display: flex; background: #eef2f6; border-radius: 8px; padding: 3px; }
  .mode button {
    display: flex; align-items: center; gap: 5px; border: 0; background: transparent;
    padding: 4px 12px; border-radius: 6px; font: 500 12.5px system-ui, sans-serif; color: #475569; cursor: pointer;
  }
  .mode button.on { background: #ffffff; color: #0f172a; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12); }

  .tabs { display: flex; align-items: flex-end; gap: 2px; height: 34px; padding: 0 8px; }
  .tab {
    height: 30px; padding: 0 14px; border: 0; background: transparent; cursor: pointer;
    font: 13px system-ui, sans-serif; color: #334155; border-bottom: 2px solid transparent;
  }
  .tab:hover { color: #0f172a; background: #f8fafc; }
  .tab.on { color: #1d4ed8; font-weight: 600; border-bottom-color: #2563eb; }

  .body {
    height: 92px; display: flex; align-items: stretch; padding: 4px 4px 2px;
    border-top: 1px solid #eef2f6; overflow-x: auto; overflow-y: hidden;
  }
  .stack { display: flex; flex-direction: column; gap: 2px; padding-top: 2px; }
  .zoomtext { font-size: 12px; color: #475569; padding-left: 8px; font-variant-numeric: tabular-nums; }

  .none { align-self: center; font-size: 12px; color: #94a3b8; padding: 0 12px; }
  .chips { display: grid; grid-auto-flow: column; grid-template-rows: repeat(2, 30px); gap: 4px 6px; padding-top: 2px; }
  .chip {
    display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px 0 8px; max-width: 180px;
    border: 1px solid #e2e8f0; border-left: 4px solid var(--c); border-radius: 7px; background: #fff; cursor: pointer;
    font: 12.5px system-ui, sans-serif; color: #1e293b;
  }
  .chip:hover:not(:disabled) { background: #f8fafc; border-color: var(--c); }
  .chip.on { background: color-mix(in srgb, var(--c) 14%, white); border-color: var(--c); font-weight: 600; }
  .chip.draft { border-style: dashed; border-left-style: solid; }
  .chip.draft::after { content: 'ยังไม่บันทึก'; font-size: 10px; font-weight: 500; color: #b45309; background: #fef3c7; border-radius: 999px; padding: 0 6px; }
  .chip i { display: none; }
  .chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chip b { font-size: 11px; font-weight: 600; color: #475569; background: #f1f5f9; border-radius: 999px; padding: 0 6px; }
  .legend { display: grid; grid-auto-flow: column; grid-template-rows: repeat(3, 20px); gap: 2px 18px; padding: 2px 6px 0; }
  .legend span { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #334155; white-space: nowrap; }
  .legend i { width: 11px; height: 11px; border-radius: 50%; display: inline-block; flex: none; }
  .legend b { margin-left: 2px; min-width: 22px; text-align: center; font-size: 11px; color: #0f172a; background: #f1f5f9; border-radius: 999px; padding: 0 6px; }

  /* ปุ่มหมวดโมเดล (เปิดแกลเลอรี) */
  .cat {
    display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 72px; height: 68px;
    padding: 2px 6px; border: 1px solid transparent; border-radius: 6px; background: transparent; cursor: pointer;
  }
  .cat:hover { background: #f1f5f9; border-color: #e2e8f0; }
  .cat.open { background: #dbeafe; border-color: #93c5fd; }
  .cat img, .ph { width: 44px; height: 44px; display: block; }
  .cat span { font-size: 11.5px; color: #1e293b; white-space: nowrap; }
  .cat .search { width: 44px; height: 44px; display: grid; place-items: center; font-size: 26px; color: #475569; }
  .ph { background: #eef2f6; border-radius: 6px; }

  /* ใช้ล่าสุด: รูปอย่างเดียว ชื่อดูได้จาก tooltip */
  .tile {
    width: 46px; height: 46px; padding: 2px; border: 1px solid transparent; border-radius: 6px;
    background: transparent; cursor: pointer;
  }
  .tile:hover { background: #f1f5f9; border-color: #e2e8f0; }
  .tile.on { background: #dbeafe; border-color: #93c5fd; }
  .tile img { width: 40px; height: 40px; display: block; }
</style>
