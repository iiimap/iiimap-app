<script lang="ts">
  import { onMount } from 'svelte';
  import { MapEngine } from '../map-engine/MapEngine';
  import { footprint } from '../domain/geometry';
  import { app, actions, statusColors, clock } from '../stores/site.svelte';
  import { guarded } from '../stores/guarded';
  import { auditSummary, fiveSColor } from '../domain/audit';

  let { engine = $bindable() }: { engine?: MapEngine } = $props();
  let container: HTMLDivElement;

  onMount(() => {
    const e = new MapEngine(container, {
      onSelect: (id) => {
        // โหมดเพิ่มสมาชิกไลน์: คลิกเครื่อง = เพิ่ม/เอาออกจากไลน์ แทนการเลือก
        if (app.lineAddMode) {
          if (id) guarded.toggleMember(id, app.lineAddMode);
          return;
        }
        app.selectedId = id;
      },
      onPlace: (x, z, rot) => actions.place(x, z, rot),
      onMoveStart: () => actions.moveStart(),
      onMove: (id, x, z) => actions.move(id, x, z),
      onZoom: (z) => (app.zoom = z),
      onHover: (id) => (app.hoverId = id)
    });
    engine = e;
    return () => e.dispose();
  });

  // สร้างพื้นผังใหม่เมื่อขนาดผังเปลี่ยน (เช่น Import ผังอื่นเข้ามา)
  $effect(() => {
    const { width, depth, id } = app.site;
    engine?.loadSite({
      width, depth, id, name: '', tenantId: '',
      lines: [], andonStates: [], metrics: { failureStates: [] }, kpis: [], reasons: [], incidents: [], audits: [], auditConfig: undefined as never, assets: []
    });
  });

  // ส่งข้อมูลจาก store เข้า map engine ทุกครั้งที่เปลี่ยน
  $effect(() => {
    const site = $state.snapshot(app.site);
    engine?.syncAssets(site.assets, statusColors(site, clock.minute));
  });
  $effect(() => {
    engine?.setSelected(app.lineAddMode ? null : app.selectedId);
  });
  $effect(() => {
    // โหมดเพิ่มสมาชิก: ห้ามลากย้ายเครื่อง ให้คลิกได้อย่างเดียว
    engine?.setMode(app.lineAddMode ? 'view' : app.mode);
  });
  $effect(() => {
    engine?.setPlacing(app.placing, app.placeRot);
  });
  $effect(() => {
    engine?.setGridVisible(app.showGrid);
  });

  // คำขอให้กล้องพาไปที่จุด (จากแผงรายการ เช่น ถังดับเพลิง / 5ส)
  $effect(() => {
    const f = app.focus;
    if (f) engine?.flyTo(f.x, f.z, 160);
  });

  // ไฟกะพริบ = เรื่อง Andon ที่ยังรอรับเรื่อง
  $effect(() => {
    const ids = app.site.incidents.filter((i) => i.resolvedAt === null && i.ackAt === null).map((i) => i.assetId);
    engine?.setBlinking(ids);
  });

  // ไฮไลต์สมาชิกของไลน์ที่กำลังดู (รวมไลน์ที่เพิ่งสร้าง)
  $effect(() => {
    const lid = app.ribbonTab === 'fiveS' ? app.fiveSLineId : app.activeLineId;
    const line = app.site.lines.find((l) => l.id === lid);
    const ids = line ? app.site.assets.filter((a) => a.lineId === line.id).map((a) => a.id) : [];
    engine?.setHighlighted(ids, line?.color ?? '#7c3aed');
  });

  // กรอบไลน์อัตโนมัติ: ล้อมสมาชิกทุกตัว + เผื่อขอบ 0.5 ม.
  $effect(() => {
    // แท็บ 5ส: กรอบทุกไลน์เป็นสีตามคะแนน 5ส ล่าสุด
    const fiveS = app.ribbonTab === 'fiveS';
    const groups = app.site.lines
      .filter((l) => fiveS || app.frameLines.includes(l.id) || l.id === app.activeLineId)
      .map((l) => ({
        color: fiveS
          ? fiveSColor(auditSummary(app.site, 'fiveS', l.id, clock.minute).last?.score ?? null, app.site.auditConfig.fiveS.passScore, app.site.auditConfig.fiveS.goodScore)
          : l.color,
        strong: fiveS ? l.id === app.fiveSLineId : l.id === app.activeLineId,
        members: app.site.assets.filter((a) => a.lineId === l.id)
      }));
    const frames = groups
      .map(({ color, strong, members }) => {
        if (!members.length) return null;
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const a of members) {
          const [fw, fd] = footprint(a.w, a.d, a.rot);
          x0 = Math.min(x0, a.x - fw / 2);
          x1 = Math.max(x1, a.x + fw / 2);
          z0 = Math.min(z0, a.z - fd / 2);
          z1 = Math.max(z1, a.z + fd / 2);
        }
        const pad = 0.5;
        return { x0: x0 - pad, z0: z0 - pad, x1: x1 + pad, z1: z1 + pad, color, strong };
      })
      .filter((f) => f !== null);
    engine?.setLineFrames(frames);
  });
</script>

<div class="map" class:placing={app.placing} class:picking={app.lineAddMode} bind:this={container}></div>

<style>
  .map { position: absolute; inset: 0; cursor: grab; }
  .map.placing, .map.picking { cursor: crosshair; }
</style>
