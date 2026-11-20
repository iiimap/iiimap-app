<script lang="ts">
  import MapCanvas from '../lib/components/MapCanvas.svelte';
  import Ribbon from '../lib/components/ribbon/Ribbon.svelte';
  import StatusBar from '../lib/components/StatusBar.svelte';
  import Properties from '../lib/components/Properties.svelte';
  import Labels from '../lib/components/Labels.svelte';
  import LineConfig from '../lib/components/panels/LineConfig.svelte';
  import ConfirmModal from '../lib/components/ConfirmModal.svelte';
  import { guarded } from '../lib/stores/guarded';
  import AndonPanel from '../lib/components/panels/AndonPanel.svelte';
  import KpiPanel from '../lib/components/panels/KpiPanel.svelte';
  import Toast from '../lib/components/Toast.svelte';
  import SettingsCenter from '../lib/components/settings/SettingsCenter.svelte';
  import TvOverlay from '../lib/components/TvOverlay.svelte';
  import FirePanel from '../lib/components/audit/FirePanel.svelte';
  import FiveSPanel from '../lib/components/audit/FiveSPanel.svelte';
  import AuditForm from '../lib/components/audit/AuditForm.svelte';
  import type { MapEngine } from '../lib/map-engine/MapEngine';
  import { app, actions } from '../lib/stores/site.svelte';

  let engine = $state<MapEngine>();

  // คีย์ลัด (ไม่ทำงานตอนพิมพ์ในช่องกรอก)
  // ใช้ e.code = ตำแหน่งปุ่มจริง จึงใช้ได้แม้คีย์บอร์ดเป็นภาษาไทย
  function onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    // ในช่องพิมพ์: Enter = เสร็จสิ้นการแก้ไข (ออกจากช่อง → บันทึกค่าและลงประวัติย้อนกลับ)
    // (ช่องในฟอร์ม เช่น ตั้งค่าผัง: ปล่อยให้ Enter = กดบันทึกของฟอร์มนั้น)
    if (t instanceof HTMLInputElement && t.type !== 'checkbox' && !t.form && (e.code === 'Enter' || e.code === 'NumpadEnter')) {
      e.preventDefault();
      t.blur();
      return;
    }
    if (t.closest('input, select, textarea')) return;
    if (app.settings) return; // ศูนย์ตั้งค่าเปิดอยู่: คีย์ลัดของผังหยุดทำงาน

    // Ctrl+, = เปิดศูนย์ตั้งค่า
    if ((e.ctrlKey || e.metaKey) && e.code === 'Comma' && !app.tvMode) {
      e.preventDefault();
      app.settings = 'site';
      return;
    }

    if (e.code === 'Escape' && app.tvMode) {
      actions.exitTv();
      return;
    }
    if (app.tvMode) return; // โหมด TV: ปิดคีย์ลัดแก้ไขทั้งหมด
    if (e.code === 'Escape') {
      if (app.lineAddMode) app.lineAddMode = null;
      else if (app.placing) app.placing = null;
      else app.selectedId = null;
    }
    if (app.mode !== 'edit') return;

    const mod = e.ctrlKey || e.metaKey; // Ctrl (Windows) หรือ ⌘ (Mac)
    if (mod) {
      switch (e.code) {
        case 'KeyZ':
          e.preventDefault();
          if (e.shiftKey) actions.redo();
          else actions.undo();
          return;
        case 'KeyY':
          e.preventDefault();
          actions.redo();
          return;
        case 'KeyC':
          e.preventDefault();
          actions.copy();
          return;
        case 'KeyX':
          e.preventDefault();
          actions.cut();
          return;
        case 'KeyV':
          e.preventDefault();
          actions.paste();
          return;
      }
      return;
    }

    if (e.code === 'KeyR') {
      if (app.placing) app.placeRot = (app.placeRot + 1) % 4;
      else if (app.selectedId) actions.rotate(app.selectedId);
    }
    if (e.code === 'Delete' || e.code === 'Backspace') {
      // ลบเครื่องที่เลือก หรือถ้าไม่ได้เลือกเครื่อง ลบไลน์ที่เลือกอยู่ (ถามย้ำก่อนเสมอ)
      if (app.selectedId) {
        e.preventDefault();
        guarded.removeAsset(app.selectedId);
      } else if (app.activeLineId) {
        e.preventDefault();
        if (app.activeLineId === app.draftLineId) guarded.cancelDraft();
        else guarded.deleteLine(app.activeLineId);
      }
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<main>
  {#if !app.tvMode}<Ribbon {engine} />{/if}
  <div class="stage">
    <MapCanvas bind:engine />
    <Labels {engine} />
    {#if !app.tvMode}
      <LineConfig />
      {#if app.ribbonTab === 'andon'}<AndonPanel />{/if}
      {#if app.ribbonTab === 'kpi'}<KpiPanel />{/if}
      {#if app.ribbonTab === 'fiveS'}<FiveSPanel />{/if}
      {#if app.ribbonTab === 'fire'}<FirePanel />{/if}
      <Properties />
    {/if}
    <TvOverlay {engine} />
    <Toast />
  </div>
  {#if !app.tvMode}<StatusBar {engine} />{/if}
</main>

<SettingsCenter />
<AuditForm />
<ConfirmModal />

<style>
  :global(body) { margin: 0; background: #f4f6f9; }
  main { position: fixed; inset: 0; display: flex; flex-direction: column; overflow: hidden; }
  .stage { position: relative; flex: 1; min-height: 0; overflow: hidden; }
</style>
