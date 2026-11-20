<script lang="ts">
  import { app, actions } from '../stores/site.svelte';
  import { exportFile, readFile } from '../stores/persist';
  import { ask } from '../stores/confirm.svelte';

  let open = $state(false);
  let error = $state('');
  let input: HTMLInputElement;

  function onExport() {
    open = false;
    exportFile($state.snapshot(app.site));
  }

  function onImportClick() {
    open = false;
    input.click();
  }

  async function onFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    (e.currentTarget as HTMLInputElement).value = ''; // เลือกไฟล์เดิมซ้ำได้
    if (!file) return;
    const site = await readFile(file);
    if (!site) {
      error = 'ไฟล์นี้ไม่ใช่ไฟล์ผัง iiiMap หรือไฟล์เสียหาย';
      setTimeout(() => (error = ''), 4000);
      return;
    }
    if (!(await ask({ title: `เปิดผัง "${site.name}" แทนผังปัจจุบัน?`, message: 'ผังปัจจุบันจะถูกแทนที่ (Export เก็บไว้ก่อนได้)', confirmText: 'เปิดผัง' }))) return;
    actions.loadSite(site);
  }

  async function onNew() {
    open = false;
    if (!(await ask({ title: 'เริ่มผังใหม่ว่างเปล่า?', message: 'ผังปัจจุบันจะถูกลบ (Export เก็บไว้ก่อนได้)', confirmText: 'เริ่มผังใหม่' }))) return;
    actions.newSite();
  }
</script>

<svelte:window onclick={() => (open = false)} />

<div class="wrap">
  <button class="trigger" class:on={open} onclick={(e) => { e.stopPropagation(); open = !open; }}>
    ไฟล์
  </button>
  {#if open}
    <div class="menu" role="menu">
      <button role="menuitem" onclick={() => { open = false; app.settings = 'site'; }}>⚙ ตั้งค่า…</button>
      <hr />
      <button role="menuitem" onclick={onExport}>⬇ Export ผัง (.json)</button>
      <button role="menuitem" onclick={onImportClick}>⬆ Import ผัง…</button>
      <hr />
      <button role="menuitem" class="danger" onclick={onNew}>ผังใหม่</button>
    </div>
  {/if}
  <input bind:this={input} type="file" accept=".json,application/json" onchange={onFile} hidden />
</div>

{#if error}
  <div class="toast">{error}</div>
{/if}

<style>
  .wrap { position: relative; }
  .trigger {
    height: 30px; padding: 0 16px; border: 0; border-radius: 6px 6px 0 0; margin-right: 4px;
    background: #2563eb; color: #ffffff; font: 600 13px system-ui, sans-serif; cursor: pointer;
  }
  .trigger:hover, .trigger.on { background: #1d4ed8; }
  .menu {
    position: absolute; top: 32px; left: 0; min-width: 190px; padding: 4px; z-index: 10;
    background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
    display: flex; flex-direction: column;
  }
  .menu button {
    border: 0; background: transparent; text-align: left; padding: 8px 10px; border-radius: 6px;
    font: 13px system-ui, sans-serif; color: #0f172a; cursor: pointer;
  }
  .menu button:hover { background: #f1f5f9; }
  .menu .danger { color: #dc2626; }
  hr { border: 0; border-top: 1px solid #f1f5f9; margin: 4px 0; }
  .toast {
    position: fixed; top: 64px; left: 50%; transform: translateX(-50%); z-index: 20;
    padding: 10px 16px; border-radius: 8px; background: #fef2f2; color: #b91c1c;
    border: 1px solid #fecaca; font: 13px system-ui, sans-serif;
  }
</style>
