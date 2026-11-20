<script lang="ts">
  // ศูนย์ตั้งค่า: รวมการตั้งค่าทั้งระบบไว้ที่เดียว
  // ทุกอย่างที่แก้เป็นฉบับร่าง จนกว่าจะกด "บันทึก" ที่แถบด้านล่าง
  import { app, actions, type SettingsDraft, type SettingsSection } from '../../stores/site.svelte';
  import { ask } from '../../stores/confirm.svelte';
  import SiteSection from './SiteSection.svelte';
  import AuditSection from './AuditSection.svelte';

  const NAV: { group: string; items: { id: SettingsSection; label: string; icon: string }[] }[] = [
    { group: 'ทั่วไป', items: [{ id: 'site', label: 'ผังโรงงาน', icon: 'factory' }] },
    {
      group: 'โมดูล',
      items: [
        { id: 'fiveS', label: '5ส', icon: 'sparkle' },
        { id: 'fire', label: 'ถังดับเพลิง', icon: 'fire' }
      ]
    }
  ];
  const ICON: Record<string, string> = {
    factory: 'M3 21V10l5 3V10l5 3V6l8 4v11z M7 17h2 M12 17h2 M17 17h2',
    sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z',
    fire: 'M9 8h6v12a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z M10 8V5h4v3 M14 5h3l2 2 M12 12v4'
  };

  let draft = $state<SettingsDraft | null>(null);
  let base = ''; // ค่าตอนเปิด (ไว้เทียบว่าแก้อะไรไปบ้าง)
  let error = $state('');
  let wasOpen = false;
  let saved = $state(false); // แสดง "บันทึกแล้ว" สั้นๆ หลังกดบันทึก
  let savedTimer: ReturnType<typeof setTimeout> | undefined;

  // เปิดศูนย์ตั้งค่า = เริ่มร่างจากค่าปัจจุบัน
  $effect(() => {
    const open = app.settings !== null;
    if (open && !wasOpen) {
      draft = actions.settingsDraft();
      base = JSON.stringify(draft);
      error = '';
      saved = false;
    }
    if (!open) draft = null;
    wasOpen = open;
  });

  // ช่องหัวข้อที่ว่าง / ซ้ำ ไม่นับเป็นการแก้ (ตอนบันทึกจะถูกตัดออกอยู่แล้ว)
  const clean = (list: string[]) => [...new Set(list.map((x) => x.trim()).filter(Boolean))];
  function norm(d: SettingsDraft): SettingsDraft {
    const x = JSON.parse(JSON.stringify(d)) as SettingsDraft;
    x.audit.fire.checklist = clean(x.audit.fire.checklist);
    x.audit.fiveS.categories = clean(x.audit.fiveS.categories);
    return x;
  }

  // นับว่าแก้กี่รายการ (และแก้หน้าไหนบ้าง)
  function diff(d: SettingsDraft | null) {
    if (!d) return { total: 0, by: {} as Record<SettingsSection, number> };
    const b = JSON.parse(base) as SettingsDraft;
    d = norm(d);
    const ne = (x: unknown, y: unknown) => JSON.stringify(x) !== JSON.stringify(y);
    const site = [ne(d.name.trim(), b.name), ne(d.width, b.width) || ne(d.depth, b.depth)].filter(Boolean).length;
    const mod = (k: 'fire' | 'fiveS') =>
      Object.keys(d.audit[k]).filter((key) => ne((d.audit[k] as Record<string, unknown>)[key], (b.audit[k] as Record<string, unknown>)[key])).length;
    const by = { site, fiveS: mod('fiveS'), fire: mod('fire') };
    return { total: by.site + by.fiveS + by.fire, by };
  }
  let changes = $derived(diff(draft));

  function save() {
    if (!draft) return;
    error = actions.saveSettings(draft);
    if (error) {
      if (error.includes('ผัง')) app.settings = 'site';
      return;
    }
    base = JSON.stringify(actions.settingsDraft());
    draft = actions.settingsDraft();
    saved = true;
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => (saved = false), 1800);
  }

  async function discard() {
    if (!(await ask({ title: 'ยกเลิกการแก้ไขทั้งหมด?', message: `สิ่งที่แก้ไว้ ${changes.total} รายการจะกลับเป็นค่าเดิม`, confirmText: 'ยกเลิกการแก้ไข' }))) return;
    draft = JSON.parse(base);
    error = '';
  }

  async function close() {
    if (changes.total && !(await ask({ title: 'ปิดโดยไม่บันทึก?', message: `มีการแก้ไข ${changes.total} รายการที่ยังไม่บันทึก จะหายไปทั้งหมด`, confirmText: 'ปิดโดยไม่บันทึก' })))
      return;
    app.settings = null;
  }

  function onKey(e: KeyboardEvent) {
    if (!app.settings) return; // หน้าต่างยืนยันจะดักคีย์ไว้ก่อนเองตอนเปิดอยู่
    if (e.code === 'Escape') {
      e.preventDefault();
      close();
    } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
      e.preventDefault();
      if (changes.total) save();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if app.settings && draft}
  <div class="backdrop" role="presentation" onpointerdown={(e) => e.target === e.currentTarget && close()}>
    <div class="win" role="dialog" aria-modal="true" aria-label="ตั้งค่า">
      <nav>
        <div class="title">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
          ตั้งค่า
        </div>
        {#each NAV as g}
          <div class="group">{g.group}</div>
          {#each g.items as it}
            <button class="item" class:on={app.settings === it.id} onclick={() => (app.settings = it.id)}>
              <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d={ICON[it.icon]} /></svg>
              <span>{it.label}</span>
              {#if changes.by[it.id]}<i class="dirty" title="มีการแก้ไขที่ยังไม่บันทึก"></i>{/if}
            </button>
          {/each}
        {/each}
      </nav>

      <section class="main">
        <button class="x" title="ปิด (Esc)" aria-label="ปิด" onclick={close}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12 M18 6L6 18" /></svg>
        </button>
        <div class="scroll">
          {#if app.settings === 'site'}
            <SiteSection bind:draft={draft} {error} />
          {:else if app.settings === 'fiveS'}
            <AuditSection module="fiveS" bind:draft={draft} />
          {:else}
            <AuditSection module="fire" bind:draft={draft} />
          {/if}
        </div>

        {#if saved && !changes.total && !error}
          <div class="savebar ok"><i></i><span>บันทึกการตั้งค่าแล้ว</span></div>
        {:else if changes.total || error}
          <div class="savebar" class:err={!!error}>
            <i></i>
            <span>{error || `มีการแก้ไข ${changes.total} รายการที่ยังไม่บันทึก`}</span>
            {#if changes.total}
              <button class="ghost" onclick={discard}>ยกเลิกการแก้ไข</button>
              <button class="primary" title="บันทึก (Ctrl+S)" onclick={save}>บันทึก</button>
            {/if}
          </div>
        {/if}
      </section>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed; inset: 0; z-index: 90; display: grid; place-items: center;
    background: rgba(15, 23, 42, 0.36); font-family: system-ui, sans-serif;
    animation: fade 0.15s ease-out;
  }
  .win {
    width: min(900px, calc(100vw - 32px)); height: min(660px, calc(100vh - 48px));
    display: grid; grid-template-columns: 200px minmax(0, 1fr);
    background: #fff; border-radius: 14px; overflow: hidden;
    box-shadow: 0 24px 64px rgba(15, 23, 42, 0.28);
    animation: pop 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.2);
  }
  nav { background: #f8fafc; border-right: 1px solid #eef2f6; padding: 14px 10px; display: flex; flex-direction: column; gap: 2px; }
  .title { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 15px; color: #0f172a; padding: 2px 10px 10px; }
  .group { font-size: 11px; color: #94a3b8; padding: 12px 10px 4px; letter-spacing: 0.02em; }
  .item {
    display: flex; align-items: center; gap: 10px; border: 0; background: transparent; text-align: left;
    padding: 8px 10px; border-radius: 8px; font: 13.5px system-ui, sans-serif; color: #475569; cursor: pointer;
  }
  .item span { flex: 1; }
  .item:hover { background: #eef2f6; color: #0f172a; }
  .item.on { background: #e0ecff; color: #1d4ed8; font-weight: 600; }
  .dirty { width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; }
  svg { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; flex: none; }
  .title svg { color: #64748b; }

  .main { position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  .scroll { flex: 1; overflow-y: auto; padding: 24px 32px 32px; }
  .x {
    position: absolute; top: 12px; right: 12px; z-index: 1; width: 32px; height: 32px; display: grid; place-items: center;
    border: 0; background: transparent; border-radius: 8px; color: #64748b; cursor: pointer;
  }
  .x:hover { background: #f1f5f9; color: #0f172a; }

  .savebar {
    display: flex; align-items: center; gap: 10px; padding: 12px 20px 12px 32px;
    background: #fffbeb; border-top: 1px solid #fde68a; animation: up 0.18s ease-out;
  }
  .savebar i { width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; flex: none; }
  .savebar span { flex: 1; font-size: 13px; color: #92400e; }
  .savebar.ok { background: #f0fdf4; border-top-color: #bbf7d0; }
  .savebar.ok i { background: #16a34a; }
  .savebar.ok span { color: #166534; }
  .savebar.err { background: #fef2f2; border-top-color: #fecaca; }
  .savebar.err i { background: #dc2626; }
  .savebar.err span { color: #b91c1c; }
  .savebar button { border-radius: 8px; padding: 8px 16px; font: 600 13px system-ui, sans-serif; cursor: pointer; }
  .ghost { border: 1px solid #e2e8f0; background: #fff; color: #334155; }
  .ghost:hover { background: #f8fafc; }
  .primary { border: 0; background: #2563eb; color: #fff; }
  .primary:hover { background: #1d4ed8; }

  @keyframes fade { from { opacity: 0; } }
  @keyframes pop { from { opacity: 0; transform: scale(0.97) translateY(6px); } }
  @keyframes up { from { transform: translateY(100%); } }

  @media (max-width: 640px) {
    .win { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }
    nav { flex-direction: row; overflow-x: auto; border-right: 0; border-bottom: 1px solid #eef2f6; }
    .group, .title { display: none; }
    .scroll { padding: 20px 16px; }
  }
</style>
