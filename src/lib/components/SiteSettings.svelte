<script lang="ts">
  // หน้าต่างตั้งค่าผัง: ชื่อโรงงาน + ขนาดผัง (กว้าง × ลึก เป็นเมตร)
  import { app, actions, assetsOutside, SITE_MIN, SITE_MAX } from '../stores/site.svelte';
  import { ask } from '../stores/confirm.svelte';

  let name = $state('');
  let width = $state('');
  let depth = $state('');
  let error = $state('');
  let first = $state<HTMLInputElement>();

  // เปิดหน้าต่าง = โหลดค่าปัจจุบันมาแก้
  $effect(() => {
    if (!app.siteSettingsOpen) return;
    name = app.site.name;
    width = String(app.site.width);
    depth = String(app.site.depth);
    error = '';
    requestAnimationFrame(() => first?.select());
  });

  let w = $derived(Number(width));
  let d = $derived(Number(depth));
  let outside = $derived(Number.isInteger(w) && Number.isInteger(d) && w > 0 && d > 0 ? assetsOutside(w, d).length : 0);
  let dirty = $derived(
    app.siteSettingsOpen && (name.trim() !== app.site.name || w !== app.site.width || d !== app.site.depth)
  );

  function save() {
    error = actions.setSiteSettings(name, w, d);
    if (!error) app.siteSettingsOpen = false;
  }

  async function cancel() {
    if (dirty && !(await ask({ title: 'ยกเลิกการแก้ไขตั้งค่าผัง?', message: 'สิ่งที่แก้ไว้แต่ยังไม่บันทึกจะหายไป', confirmText: 'ยกเลิกการแก้ไข' })))
      return;
    app.siteSettingsOpen = false;
  }

  function onKey(e: KeyboardEvent) {
    if (!app.siteSettingsOpen) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      cancel();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if app.siteSettingsOpen}
  <div class="backdrop" role="presentation" onpointerdown={(e) => e.target === e.currentTarget && cancel()}>
    <form class="modal" onsubmit={(e) => { e.preventDefault(); save(); }}>
      <h3>ตั้งค่าผัง</h3>

      <label>
        ชื่อผัง / ชื่อโรงงาน
        <input bind:this={first} bind:value={name} placeholder="เช่น โรงงานระยอง อาคาร 2" oninput={() => (error = '')} />
      </label>

      <div class="row">
        <label>
          กว้าง (ม.)
          <input bind:value={width} inputmode="numeric" oninput={() => (error = '')} />
        </label>
        <span class="x">×</span>
        <label>
          ลึก (ม.)
          <input bind:value={depth} inputmode="numeric" oninput={() => (error = '')} />
        </label>
      </div>
      <p class="hint">ขนาด {SITE_MIN}–{SITE_MAX} ม. · ผังขยายหรือหดจากกึ่งกลาง เครื่องที่วางไว้อยู่ที่เดิม</p>

      {#if outside > 0}
        <p class="warn">⚠ ถ้าใช้ขนาดนี้ เครื่อง {outside} ตัวจะหลุดขอบผัง</p>
      {/if}
      {#if error}<p class="error">{error}</p>{/if}

      <div class="btns">
        <button type="button" class="cancel" onclick={cancel}>ยกเลิก</button>
        <button type="submit" class="ok" disabled={!dirty}>บันทึก</button>
      </div>
    </form>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed; inset: 0; z-index: 90; display: grid; place-items: center;
    background: rgba(15, 23, 42, 0.32); font-family: system-ui, sans-serif;
  }
  .modal {
    width: min(400px, calc(100vw - 32px)); padding: 20px; border-radius: 12px; background: #fff;
    box-shadow: 0 20px 48px rgba(15, 23, 42, 0.25); display: flex; flex-direction: column; gap: 12px;
  }
  h3 { margin: 0; font-size: 16px; color: #0f172a; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #64748b; min-width: 0; }
  input {
    font: 14px system-ui, sans-serif; color: #0f172a; padding: 8px 10px; border: 1px solid #e2e8f0;
    border-radius: 8px; min-width: 0; width: 100%; box-sizing: border-box;
  }
  input:focus { outline: none; border-color: #93c5fd; box-shadow: 0 0 0 2px #dbeafe; }
  .row { display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; align-items: end; }
  .x { padding-bottom: 9px; color: #94a3b8; }
  .hint { margin: -4px 0 0; font-size: 11.5px; color: #94a3b8; }
  .warn { margin: 0; font-size: 12.5px; color: #b45309; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px 10px; }
  .error { margin: 0; font-size: 12.5px; color: #dc2626; }
  .btns { display: flex; justify-content: flex-end; gap: 8px; }
  button { border-radius: 8px; padding: 8px 16px; font: 600 13px system-ui, sans-serif; cursor: pointer; }
  .cancel { border: 1px solid #e2e8f0; background: #fff; color: #334155; }
  .ok { border: 0; background: #2563eb; color: #fff; }
  .ok:disabled { opacity: 0.4; cursor: default; }
</style>
