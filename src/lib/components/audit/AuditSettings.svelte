<script lang="ts">
  // ตั้งค่าการตรวจ: รอบตรวจ, เตือนล่วงหน้า, (5ส) เกณฑ์ผ่าน, รายการหัวข้อ
  import type { AuditModule } from '../../domain/types';
  import { app, actions } from '../../stores/site.svelte';
  import { guarded } from '../../stores/guarded';

  let { module }: { module: AuditModule } = $props();
  let editable = $derived(app.mode === 'edit');
  let cfg = $derived(app.site.auditConfig[module]);
  let items = $derived(module === 'fire' ? app.site.auditConfig.fire.checklist : app.site.auditConfig.fiveS.categories);

  function num(key: 'intervalDays' | 'dueSoonDays' | 'passScore', e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    actions.setAuditNumber(module, key, Number(el.value));
    el.value = String((app.site.auditConfig[module] as Record<string, number>)[key]);
  }
</script>

<div class="set">
  <div class="nums">
    <label>ตรวจทุก (วัน)<input type="number" min="1" value={cfg.intervalDays} disabled={!editable} onchange={(e) => num('intervalDays', e)} /></label>
    <label>เตือนล่วงหน้า (วัน)<input type="number" min="0" value={cfg.dueSoonDays} disabled={!editable} onchange={(e) => num('dueSoonDays', e)} /></label>
    {#if module === 'fiveS'}
      <label>เกณฑ์ผ่าน (%)<input type="number" min="0" max="100" value={app.site.auditConfig.fiveS.passScore} disabled={!editable} onchange={(e) => num('passScore', e)} /></label>
    {/if}
  </div>

  <span class="lbl">{module === 'fire' ? 'เช็กลิสต์' : 'หัวข้อที่ให้คะแนน (0–5)'}</span>
  <div class="items">
    {#each items as _, i}
      <div class="it">
        {#if module === 'fire'}
          <input bind:value={app.site.auditConfig.fire.checklist[i]} disabled={!editable} onfocus={() => actions.beginEdit()} onchange={() => actions.commitEdit()} />
        {:else}
          <input bind:value={app.site.auditConfig.fiveS.categories[i]} disabled={!editable} onfocus={() => actions.beginEdit()} onchange={() => actions.commitEdit()} />
        {/if}
        {#if editable}
          <button class="x" title="ลบหัวข้อ" aria-label="ลบหัวข้อ" disabled={items.length <= 1} onclick={() => guarded.removeAuditItem(module, i)}>×</button>
        {/if}
      </div>
    {/each}
  </div>
  {#if editable}
    <div class="btns">
      <button onclick={() => actions.addAuditItem(module)}>+ เพิ่มหัวข้อ</button>
      <button class="ghost" onclick={() => guarded.resetAuditConfig(module)}>คืนค่าเริ่มต้น</button>
    </div>
  {/if}
</div>

<style>
  .set { display: flex; flex-direction: column; gap: 8px; font-family: system-ui, sans-serif; }
  .nums { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 8px; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; color: #64748b; min-width: 0; }
  input { font: 13px system-ui, sans-serif; padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 6px; color: #0f172a; min-width: 0; width: 100%; box-sizing: border-box; }
  input:focus { outline: none; border-color: #93c5fd; box-shadow: 0 0 0 2px #dbeafe; }
  input:disabled { background: #f8fafc; color: #475569; }
  .lbl { font-size: 11.5px; color: #64748b; margin-top: 2px; }
  .items { display: flex; flex-direction: column; gap: 4px; }
  .it { display: grid; grid-template-columns: 1fr 24px; gap: 6px; align-items: center; }
  .x { border: 0; background: transparent; color: #94a3b8; font-size: 16px; cursor: pointer; border-radius: 6px; height: 26px; padding: 0; }
  .x:hover:not(:disabled) { background: #fef2f2; color: #dc2626; }
  .x:disabled { opacity: 0.3; cursor: default; }
  .btns { display: flex; gap: 6px; }
  .btns button { border: 1px solid #e2e8f0; background: #fff; border-radius: 7px; padding: 6px 10px; font: 12px system-ui, sans-serif; color: #1e293b; cursor: pointer; }
  .btns .ghost { color: #64748b; }
</style>
