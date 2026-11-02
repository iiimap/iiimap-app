<script lang="ts">
  // กล่องตั้งค่าไลน์: แสดงเฉพาะตอนเลือกไลน์ (จาก Ribbon) คลิกที่อื่นบนหน้าเว็บแล้วปิด
  import { MODELS, MODE_LABEL } from '../../domain/catalog';
  import { app, actions, andonColors } from '../../stores/site.svelte';
  import { guarded } from '../../stores/guarded';

  const MODES = ['byLine', 'byStation'] as const;

  let line = $derived(app.site.lines.find((l) => l.id === app.activeLineId));
  let isNew = $derived(!!line && line.id === app.draftLineId);
  let editable = $derived(app.mode === 'edit');
  let colors = $derived(andonColors(app.site));
  let query = $state('');

  let members = $derived(
    line ? app.site.assets.filter((a) => a.lineId === line!.id).sort((a, b) => a.name.localeCompare(b.name, 'th')) : []
  );

  // ผลค้นหาเครื่องที่จะเพิ่ม (ไม่รวมที่อยู่ในไลน์นี้แล้ว)
  let candidates = $derived.by(() => {
    if (!line) return [];
    const q = query.trim().toLowerCase();
    return app.site.assets
      .filter((a) => a.lineId !== line!.id)
      .filter((a) => !q || a.name.toLowerCase().includes(q) || (MODELS[a.kind]?.label ?? '').toLowerCase().includes(q))
      .sort((a, b) => Number(!!a.lineId) - Number(!!b.lineId) || a.name.localeCompare(b.name, 'th'))
      .slice(0, 8);
  });

  const lineName = (id: string | null) => app.site.lines.find((l) => l.id === id)?.name ?? '';

  // แก้ไลน์ที่ยังไม่บันทึก ไม่ต้องลงประวัติทีละช่อง (ลงครั้งเดียวตอนกดบันทึก)
  const begin = () => !isNew && actions.beginEdit();
  const commit = () => !isNew && actions.commitEdit();

  function close() {
    app.activeLineId = null;
    app.lineAddMode = null;
  }

  // คลิกที่อื่นบนหน้าเว็บ = ปิดกล่อง
  // ยกเว้น: ไลน์ที่ยังไม่บันทึก (ต้องกดบันทึก/ยกเลิก), กำลังคลิกเลือกเครื่องบนผัง, คลิกบน Ribbon หรือหน้าต่างถามย้ำ
  function onOutside(e: PointerEvent) {
    if (!line || isNew || app.lineAddMode) return;
    const t = e.target as HTMLElement;
    if (t.closest('.linecfg, .ribbon, .backdrop, .dd-panel')) return;
    close();
  }

  $effect(() => {
    // เปลี่ยนไลน์ = ล้างช่องค้นหา
    void app.activeLineId;
    query = '';
  });
</script>

<svelte:window onpointerdown={onOutside} />

{#if line}
  <aside class="linecfg" class:isnew={isNew} style="--c:{line.color}">
    <div class="top">
      {#if isNew}<span class="newtag">ไลน์ใหม่ · ยังไม่บันทึก</span>{:else}<span class="ttl">ตั้งค่าไลน์</span>{/if}
      {#if !isNew}<button class="icon" title="ปิด" onclick={close}>×</button>{/if}
    </div>

    <div class="head">
      <input class="swatch" type="color" bind:value={line.color} disabled={!editable}
        onfocus={begin} onchange={commit} title="สีประจำไลน์" />
      {#if editable}
        <input class="name" bind:value={line.name} placeholder="ชื่อไลน์"
          onfocus={begin} onchange={commit} oninput={() => (app.draftError = '')} />
      {:else}
        <span class="name ro">{line.name}</span>
      {/if}
      <span class="badge" title="จำนวนเครื่องในไลน์">{members.length}</span>
    </div>

    <div class="modes" role="group" aria-label="โหมด Andon">
      {#each MODES as m}
        <button class:on={line.mode === m} disabled={!editable} onclick={() => actions.setLineMode(line!.id, m)}>
          {MODE_LABEL[m]}
        </button>
      {/each}
    </div>

    <h4>เครื่องในไลน์</h4>
    {#if members.length === 0}<p class="hint">ยังไม่มีเครื่องในไลน์นี้</p>{/if}
    <ul class="members">
      {#each members as a (a.id)}
        <li class:sel={app.selectedId === a.id}>
          <span class="dot" style="background:{a.andon ? colors[a.id] : 'transparent'}; border-color:{a.andon ? colors[a.id] : '#cbd5e1'}"></span>
          <b>{a.name}</b>
          <small>{MODELS[a.kind]?.label ?? a.kind}</small>
          {#if editable}
            <button class="icon x" title="เอาออกจากไลน์" onclick={() => guarded.removeFromLine(a.id)}>×</button>
          {/if}
        </li>
      {/each}
    </ul>

    {#if editable}
      <h4>เพิ่มเครื่องเข้าไลน์</h4>
      <input class="search" bind:value={query} placeholder="พิมพ์ชื่อเครื่อง เช่น CNC-01" />
      {#if candidates.length}
        <ul class="cands">
          {#each candidates as a (a.id)}
            <li>
              <button onclick={() => guarded.addToLine(a.id, line!.id)}>
                <b>{a.name}</b>
                <small>{MODELS[a.kind]?.label ?? a.kind}</small>
                {#if a.lineId}<em>อยู่ใน {lineName(a.lineId)} · ย้ายมา</em>{:else}<span class="plus">+</span>{/if}
              </button>
            </li>
          {/each}
        </ul>
      {:else if app.site.assets.length === 0}
        <p class="hint">ยังไม่มีเครื่องบนผัง วางโมเดลจากแท็บแทรกก่อน</p>
      {:else}
        <p class="hint">ไม่พบเครื่องที่ค้นหา</p>
      {/if}

      <button class="pick" class:on={app.lineAddMode === line.id}
        onclick={() => (app.lineAddMode = app.lineAddMode === line!.id ? null : line!.id)}>
        {app.lineAddMode === line.id ? '✓ กำลังเลือกบนผัง… (กดอีกครั้งหรือ Esc เพื่อจบ)' : '⌖ คลิกเลือกเครื่องบนผัง'}
      </button>

      <div class="foot">
        {#if isNew}
          {#if app.draftError}<p class="error">{app.draftError}</p>{/if}
          <button class="ghostbtn" onclick={() => guarded.cancelDraft()}>ยกเลิก</button>
          <button class="primary" onclick={() => actions.saveDraft()}>บันทึกไลน์</button>
        {:else}
          <button class="danger" onclick={() => guarded.deleteLine(line!.id)}>ลบไลน์นี้</button>
        {/if}
      </div>
    {/if}
  </aside>
{/if}

<style>
  .linecfg {
    position: absolute; top: 16px; left: 16px; width: 300px; max-height: calc(100% - 32px); z-index: 4;
    box-sizing: border-box; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding: 12px;
    background: #ffffff; border: 1px solid #e5e7eb; border-top: 4px solid var(--c); border-radius: 12px;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12); font-family: system-ui, sans-serif;
  }
  .linecfg.isnew { border-style: dashed; border-top-style: solid; border-color: var(--c); }
  .top { display: flex; align-items: center; justify-content: space-between; }
  .ttl { font-size: 11px; font-weight: 600; color: #64748b; letter-spacing: 0.03em; }
  .newtag { font-size: 10.5px; font-weight: 600; color: #b45309; background: #fef3c7; border-radius: 999px; padding: 1px 8px; }
  .head { display: flex; align-items: center; gap: 6px; }
  .swatch { width: 26px; height: 26px; padding: 0; border: 0; background: none; cursor: pointer; flex: none; }
  .name { flex: 1; min-width: 0; font: 600 14px system-ui, sans-serif; color: #0f172a; border: 1px solid #e2e8f0; border-radius: 7px; padding: 6px 8px; }
  .name.ro { border-color: transparent; }
  .name:focus { outline: none; border-color: #93c5fd; box-shadow: 0 0 0 2px #dbeafe; }
  .badge { font-size: 11px; color: #475569; background: #f1f5f9; border-radius: 999px; padding: 1px 8px; }
  .icon { border: 0; background: transparent; color: #64748b; cursor: pointer; font-size: 16px; width: 26px; height: 26px; border-radius: 6px; }
  .icon:hover { background: #f1f5f9; color: #0f172a; }

  .modes { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 2px; }
  .modes button { border: 1px solid #e2e8f0; background: #fff; border-radius: 6px; padding: 6px 4px; font: 11.5px system-ui, sans-serif; color: #334155; cursor: pointer; line-height: 1.3; }
  .modes button.on { border-color: var(--c); color: #0f172a; font-weight: 600; background: color-mix(in srgb, var(--c) 10%, white); }
  .modes button:disabled:not(.on) { opacity: 0.5; cursor: default; }
  h4 { margin: 8px 0 0; font-size: 11px; font-weight: 600; color: #64748b; letter-spacing: 0.03em; }
  .hint { margin: 0; font-size: 12px; color: #94a3b8; }

  .members { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .members li { display: flex; align-items: center; gap: 8px; padding: 3px 4px; border-radius: 6px; }
  .members li.sel { background: #eff6ff; }
  .members b { font-size: 13px; color: #0f172a; }
  .members small { flex: 1; font-size: 11.5px; color: #94a3b8; }
  .dot { width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid; flex: none; }
  .x { width: 22px; height: 22px; }

  .search { font: 13px system-ui, sans-serif; padding: 7px 9px; border: 1px solid #e2e8f0; border-radius: 7px; }
  .search:focus { outline: none; border-color: #93c5fd; box-shadow: 0 0 0 2px #dbeafe; }
  .cands { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .cands button { width: 100%; display: flex; align-items: baseline; gap: 8px; text-align: left; border: 1px solid transparent; border-radius: 6px; background: #f8fafc; padding: 6px 8px; cursor: pointer; font-family: system-ui, sans-serif; }
  .cands button:hover { border-color: #bfdbfe; background: #eff6ff; }
  .cands b { font-size: 13px; color: #0f172a; }
  .cands small { flex: 1; font-size: 11.5px; color: #94a3b8; }
  .cands em { font-style: normal; font-size: 11px; color: #b45309; }
  .plus { color: #2563eb; font-weight: 700; }

  .pick { margin-top: 4px; border: 1px dashed #93c5fd; background: #f8fbff; color: #1d4ed8; border-radius: 7px; padding: 8px; font: 600 12px system-ui, sans-serif; cursor: pointer; }
  .pick.on { border-style: solid; background: #dbeafe; }

  .foot { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 6px; margin-top: 6px; padding-top: 8px; border-top: 1px solid #f1f5f9; }
  .error { flex-basis: 100%; margin: 0; font-size: 12px; color: #dc2626; }
  .primary { border: 0; background: #2563eb; color: #fff; border-radius: 7px; padding: 7px 12px; font: 600 12px system-ui, sans-serif; cursor: pointer; }
  .primary:hover { background: #1d4ed8; }
  .ghostbtn { border: 1px solid #e2e8f0; background: #fff; color: #334155; border-radius: 7px; padding: 7px 12px; font: 12px system-ui, sans-serif; cursor: pointer; }
  .danger { margin-right: auto; border: 1px solid #fecaca; background: #fff; color: #dc2626; border-radius: 7px; padding: 7px 12px; font: 12px system-ui, sans-serif; cursor: pointer; }
  .danger:hover { background: #fef2f2; }
</style>
