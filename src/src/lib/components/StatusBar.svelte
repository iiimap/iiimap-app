<script lang="ts">
  // แถบสถานะด้านล่าง (เหมือน Word): ข้อมูลผัง · คำแนะนำ · ซูม
  import type { MapEngine } from '../map-engine/MapEngine';
  import { MODELS } from '../domain/catalog';
  import { app } from '../stores/site.svelte';

  let { engine }: { engine?: MapEngine } = $props();

  let hint = $derived(
    app.lineAddMode
      ? `คลิกเครื่องบนผังเพื่อเพิ่ม/เอาออกจาก ${app.site.lines.find((l) => l.id === app.lineAddMode)?.name ?? 'ไลน์'}${app.lineAddMode === app.draftLineId ? ' (ยังไม่บันทึก)' : ''} · Esc เพื่อจบ`
      : app.mode === 'view'
      ? 'ลากเพื่อเลื่อนผัง · Scroll เพื่อซูม · คลิกโมเดลเพื่อดูข้อมูล'
      : app.placing
        ? `กำลังวาง ${MODELS[app.placing]?.label ?? ''} · คลิกบนผังเพื่อวาง · R หมุน · Esc เลิก`
        : 'ลากโมเดลเพื่อย้าย · R หมุน · Del ลบ · Ctrl+C/X/V คัดลอก/ตัด/วาง · Ctrl+Z ย้อน'
  );
</script>

<footer class="status">
  <span>โมเดล {app.site.assets.length} ชิ้น</span>
  <span class="sep"></span>
  <span>ไลน์ {app.site.lines.length}</span>
  <span class="sep"></span>
  <span>ผัง {app.site.width} × {app.site.depth} ม.</span>
  <span class="sep"></span>
  <span class="hint">{hint}</span>
  <span class="spacer"></span>
  <button title="หมุนทวนเข็ม" onclick={() => engine?.rotate(-1)}>⟲</button>
  <button title="หมุนตามเข็ม" onclick={() => engine?.rotate(1)}>⟳</button>
  <span class="sep"></span>
  <button title="ซูมออก" onclick={() => engine?.zoomBy(1 / 1.25)}>−</button>
  <span class="zoom">{Math.round(app.zoom * 100)}%</span>
  <button title="ซูมเข้า" onclick={() => engine?.zoomBy(1.25)}>+</button>
</footer>

<style>
  .status {
    height: 28px; flex: none; display: flex; align-items: center; gap: 10px; padding: 0 12px;
    background: #f8fafc; border-top: 1px solid #e5e7eb;
    font: 12px system-ui, sans-serif; color: #475569; white-space: nowrap; overflow: hidden;
  }
  .hint { color: #94a3b8; overflow: hidden; text-overflow: ellipsis; }
  .spacer { flex: 1; }
  .sep { width: 1px; height: 14px; background: #e2e8f0; flex: none; }
  button {
    width: 24px; height: 22px; border: 0; border-radius: 4px; background: transparent;
    color: #334155; font-size: 15px; cursor: pointer; flex: none;
  }
  button:hover { background: #e2e8f0; }
  .zoom { min-width: 40px; text-align: center; font-variant-numeric: tabular-nums; }
</style>
