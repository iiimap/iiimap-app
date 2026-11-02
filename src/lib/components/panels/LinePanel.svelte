<script lang="ts">
  // แผงตั้งค่าไลน์: ตั้งชื่อไลน์ก่อน แล้วเลือกเครื่องเข้าไลน์ตามชื่อ
  import { MODELS, MODE_LABEL } from '../../domain/catalog';
  import { app, actions, andonColors } from '../../stores/site.svelte';

  const MODES = ['byLine', 'byStation'] as const;
  let editable = $derived(app.mode === 'edit');
  let query = $state('');
  let colors = $derived(andonColors(app.site));

  const membersOf = (lineId: string) =>
    app.site.assets.filter((a) => a.lineId === lineId).sort((a, b) => a.name.localeCompare(b.name, 'th'));

  const lineName = (id: string | null) => app.site.lines.find((l) => l.id === id)?.name ?? '';

  // ผลค้นหาเครื่องที่จะเพิ่มเข้าไลน์ (ไม่รวมที่อยู่ในไลน์นี้แล้ว)
  function candidatesFor(lineId: string) {
    const q = query.trim().toLowerCase();
    return app.site.assets
      .filter((a) => a.lineId !== lineId)
      .filter((a) => !q || a.name.toLowerCase().includes(q) || (MODELS[a.kind]?.label ?? '').toLowerCase().includes(q))
      .sort((a, b) => Number(!!a.lineId) - Number(!!b.lineId) || a.name.localeCompare(b.name, 'th'))
      .slice(0, 8);
  }

  function toggleOpen(id: string) {
    app.activeLineId = app.activeLineId === id ? null : id;
    app.lineAddMode = null;
    query = '';
  }

  function create() {
    actions.startDraft();
    query = '';
  }

  // ไลน์ที่ยังไม่บันทึกแสดงไว้บนสุด
  let ordered = $derived([...app.site.lines].sort((a, b) => Number(b.id === app.draftLineId) - Number(a.id === app.draftLineId)));

  // แก้ไลน์ที่ยังไม่บันทึก ไม่ต้องลงประวัติทีละช่อง (ลงครั้งเดียวตอนกดบันทึก)
  const begin = (id: string) => id !== app.draftLineId && actions.beginEdit();
  const commit = (id: string) => id !== app.draftLineId && actions.commitEdit();
</script>

<aside class="panel">
  <header>
    <h3>ไลน์ผลิต <span class="count">{app.site.lines.length}</span></h3>
    {#if editable && !app.draftLineId}
      <button class="primary" onclick={create}>+ สร้างไลน์</button>
    {/if}
  </header>

  {#if app.site.lines.length === 0}
    <p class="empty">
      ยังไม่มีไลน์<br />
      {#if editable}กด <b>+ สร้างไลน์</b> ตั้งชื่อ แล้วเลือกเครื่องเข้าไลน์{:else}สลับเป็นโหมดแก้ไขผังเพื่อสร้างไลน์{/if}
    </p>
  {/if}

  <div class="list">
    {#each ordered as line (line.id)}
      {@const members = membersOf(line.id)}
      {@const isNew = app.draftLineId === line.id}
      {@const open = app.activeLineId === line.id || isNew}
      {@const candidates = open ? candidatesFor(line.id) : []}
      <section class="line" class:open class:isnew={isNew} style="--c:{line.color}">
        {#if isNew}<div class="newtag">ไลน์ใหม่ · ยังไม่บันทึก</div>{/if}
        <div class="head">
          <input class="swatch" type="color" bind:value={line.color} disabled={!editable}
            onfocus={() => begin(line.id)} onchange={() => commit(line.id)} title="สีประจำไลน์" />
          {#if editable}
            <input class="name" class:boxed={isNew} bind:value={line.name} placeholder="ชื่อไลน์"
              onfocus={() => begin(line.id)} onchange={() => commit(line.id)} oninput={() => (app.draftError = '')} />
          {:else}
            <span class="name ro">{line.name}</span>
          {/if}
          <span class="badge">{members.length}</span>
          {#if !isNew}
            <button class="icon" title={open ? 'ปิด' : 'ดูไลน์นี้ (ไฮไลต์ทุกเครื่องในไลน์)'} onclick={() => toggleOpen(line.id)}>
              {open ? '▴' : '▾'}
            </button>
          {/if}
        </div>

        {#if open}
          <div class="body">
            <div class="modes" role="group" aria-label="โหมด Andon">
              {#each MODES as m}
                <button class:on={line.mode === m} disabled={!editable} onclick={() => actions.setLineMode(line.id, m)}>
                  {MODE_LABEL[m]}
                </button>
              {/each}
            </div>

            <h4>เครื่องในไลน์</h4>
            {#if members.length === 0}
              <p class="hint">ยังไม่มีเครื่องในไลน์นี้</p>
            {/if}
            <ul class="members">
              {#each members as a (a.id)}
                <li class:sel={app.selectedId === a.id}>
                  <span class="dot" style="background:{a.andon ? colors[a.id] : 'transparent'}; border-color:{a.andon ? colors[a.id] : '#cbd5e1'}"></span>
                  <button class="link" onclick={() => (app.selectedId = a.id)}>{a.name}</button>
                  <small>{MODELS[a.kind]?.label ?? a.kind}</small>
                  {#if editable}
                    <button class="icon x" title="เอาออกจากไลน์" onclick={() => actions.removeFromLine(a.id)}>×</button>
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
                      <button onclick={() => actions.addToLine(a.id, line.id)}>
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
                onclick={() => (app.lineAddMode = app.lineAddMode === line.id ? null : line.id)}>
                {app.lineAddMode === line.id ? '✓ กำลังเลือกบนผัง… (กดอีกครั้งหรือ Esc เพื่อจบ)' : '⌖ คลิกเลือกเครื่องบนผัง'}
              </button>

              {#if isNew}
                {#if app.draftError}<p class="error">{app.draftError}</p>{/if}
                <div class="savebar">
                  <button class="ghostbtn" onclick={() => actions.cancelDraft()}>ยกเลิก</button>
                  <button class="primary" onclick={() => actions.saveDraft()}>บันทึกไลน์</button>
                </div>
              {:else}
                <button class="danger" onclick={() => actions.deleteLine(line.id)}>ลบไลน์นี้</button>
              {/if}
            {/if}
          </div>
        {/if}
      </section>
    {/each}
  </div>
</aside>

<style>
  .panel {
    position: absolute; top: 16px; left: 16px; bottom: 16px; width: 300px; z-index: 3;
    display: flex; flex-direction: column; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06); font-family: system-ui, sans-serif; overflow: hidden;
  }
  header { display: flex; align-items: center; justify-content: space-between; padding: 12px 12px 8px; border-bottom: 1px solid #f1f5f9; }
  h3 { margin: 0; font-size: 14px; color: #0f172a; }
  .count { font-size: 11px; color: #64748b; background: #f1f5f9; border-radius: 999px; padding: 1px 7px; margin-left: 4px; }
  .primary { border: 0; background: #2563eb; color: #fff; border-radius: 7px; padding: 6px 10px; font: 600 12px system-ui, sans-serif; cursor: pointer; }
  .primary:hover { background: #1d4ed8; }
  .empty { margin: 20px 16px; font-size: 13px; line-height: 1.7; color: #64748b; text-align: center; }
  .list { overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 6px; }

  .line.isnew { border-style: dashed; border-left-style: solid; background: color-mix(in srgb, var(--c) 4%, white); }
  .newtag { margin: 6px 8px 0; align-self: flex-start; display: inline-block; font-size: 10.5px; font-weight: 600; color: #b45309; background: #fef3c7; border-radius: 999px; padding: 1px 8px; }
  .boxed { border-color: #e2e8f0 !important; background: #fff !important; }
  .error { margin: 0; font-size: 12px; color: #dc2626; }
  .savebar { display: flex; justify-content: flex-end; gap: 6px; margin-top: 4px; }
  .ghostbtn { border: 1px solid #e2e8f0; background: #fff; color: #334155; border-radius: 7px; padding: 6px 12px; font: 12px system-ui, sans-serif; cursor: pointer; }
  .ghostbtn:hover { background: #f8fafc; }

  .line { border: 1px solid #e5e7eb; border-left: 4px solid var(--c); border-radius: 8px; }
  .line.open { border-color: var(--c); box-shadow: 0 0 0 1px var(--c) inset; }
  .head { display: flex; align-items: center; gap: 6px; padding: 6px 6px 6px 8px; }
  .swatch { width: 22px; height: 22px; padding: 0; border: 0; background: none; cursor: pointer; flex: none; }
  .name { flex: 1; min-width: 0; font: 600 13px system-ui, sans-serif; color: #0f172a; border: 1px solid transparent; border-radius: 6px; padding: 4px 6px; background: transparent; }
  .name:hover:not(.ro) { border-color: #e2e8f0; }
  .name:focus { outline: none; border-color: #93c5fd; background: #fff; }
  .badge { font-size: 11px; color: #475569; background: #f1f5f9; border-radius: 999px; padding: 1px 7px; }
  .icon { border: 0; background: transparent; color: #64748b; cursor: pointer; font-size: 14px; width: 26px; height: 26px; border-radius: 6px; }
  .icon:hover { background: #f1f5f9; color: #0f172a; }

  .body { padding: 4px 10px 10px; display: flex; flex-direction: column; gap: 6px; }
  .modes { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .modes button { border: 1px solid #e2e8f0; background: #fff; border-radius: 6px; padding: 6px 4px; font: 11.5px system-ui, sans-serif; color: #334155; cursor: pointer; line-height: 1.3; }
  .modes button.on { border-color: var(--c); color: #0f172a; font-weight: 600; background: color-mix(in srgb, var(--c) 10%, white); }
  .modes button:disabled:not(.on) { opacity: 0.5; cursor: default; }
  h4 { margin: 8px 0 2px; font-size: 11px; font-weight: 600; color: #64748b; letter-spacing: 0.03em; }
  .hint { margin: 0; font-size: 12px; color: #94a3b8; }

  .members { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .members li { display: flex; align-items: center; gap: 8px; padding: 3px 4px; border-radius: 6px; }
  .members li.sel { background: #eff6ff; }
  .dot { width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid; flex: none; }
  .link { border: 0; background: none; padding: 0; font: 600 13px system-ui, sans-serif; color: #0f172a; cursor: pointer; }
  .link:hover { color: #2563eb; }
  .members small { flex: 1; font-size: 11.5px; color: #94a3b8; }
  .x { width: 22px; height: 22px; font-size: 16px; }

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
  .danger { margin-top: 2px; border: 0; background: none; color: #dc2626; font: 12px system-ui, sans-serif; cursor: pointer; padding: 4px; align-self: flex-start; }
  .danger:hover { text-decoration: underline; }
</style>
