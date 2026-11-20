<script lang="ts">
  // ศูนย์ตั้งค่า › ผังโรงงาน: ชื่อ + ขนาดผัง (เลือกขนาดสำเร็จรูป หรือกำหนดเอง) พร้อมภาพตัวอย่าง
  import { app, assetsOutside, SITE_MIN, SITE_MAX, type SettingsDraft } from '../../stores/site.svelte';
  import { footprint } from '../../domain/geometry';

  let { draft = $bindable(), error = '' }: { draft: SettingsDraft; error?: string } = $props();

  const PRESETS = [
    { label: 'เล็ก', w: 30, d: 20 },
    { label: 'กลาง', w: 60, d: 40 },
    { label: 'ใหญ่', w: 100, d: 60 },
    { label: 'ใหญ่มาก', w: 150, d: 100 }
  ];

  let valid = $derived(Number.isInteger(draft.width) && Number.isInteger(draft.depth) && draft.width > 0 && draft.depth > 0);
  let outside = $derived(valid ? assetsOutside(draft.width, draft.depth) : []);
  let outIds = $derived(new Set(outside.map((a) => a.id)));

  // ภาพตัวอย่าง: ครอบทั้งผังเดิม ผังใหม่ และเครื่องทุกตัว
  let view = $derived.by(() => {
    let hw = Math.max(app.site.width, valid ? draft.width : 0) / 2;
    let hd = Math.max(app.site.depth, valid ? draft.depth : 0) / 2;
    for (const a of app.site.assets) {
      const [fw, fd] = footprint(a.w, a.d, a.rot);
      hw = Math.max(hw, Math.abs(a.x) + fw / 2);
      hd = Math.max(hd, Math.abs(a.z) + fd / 2);
    }
    const pad = Math.max(hw, hd) * 0.06;
    return `${-hw - pad} ${-hd - pad} ${2 * (hw + pad)} ${2 * (hd + pad)}`;
  });
  let changed = $derived(valid && (draft.width !== app.site.width || draft.depth !== app.site.depth));
  let area = $derived(valid ? (draft.width * draft.depth).toLocaleString('th-TH') : '-');
</script>

<h2>ผังโรงงาน</h2>
<p class="sub">ชื่อและขนาดของพื้นที่ที่แสดงบนผัง</p>

<div class="field">
  <label for="st-name">ชื่อผัง / ชื่อโรงงาน</label>
  <input id="st-name" bind:value={draft.name} placeholder="โรงงานระยอง อาคาร 2" class:bad={error && !draft.name.trim()} />
</div>

<div class="field">
  <span class="lbl">ขนาดผัง</span>
  <div class="chips">
    {#each PRESETS as p}
      <button class="chip" class:on={draft.width === p.w && draft.depth === p.d} onclick={() => { draft.width = p.w; draft.depth = p.d; }}>
        <b>{p.label}</b><small>{p.w}×{p.d} ม.</small>
      </button>
    {/each}
  </div>
  <div class="size">
    <label>กว้าง<span class="unit"><input type="number" min={SITE_MIN} max={SITE_MAX} bind:value={draft.width} /><em>ม.</em></span></label>
    <span class="times">×</span>
    <label>ลึก<span class="unit"><input type="number" min={SITE_MIN} max={SITE_MAX} bind:value={draft.depth} /><em>ม.</em></span></label>
    <span class="area">พื้นที่ {area} ตร.ม.</span>
  </div>
</div>

<div class="preview">
  <svg viewBox={view} preserveAspectRatio="xMidYMid meet" aria-label="ภาพตัวอย่างขนาดผัง">
    {#if valid}
      <rect class="new" x={-draft.width / 2} y={-draft.depth / 2} width={draft.width} height={draft.depth} />
    {/if}
    {#if changed}
      <rect class="old" x={-app.site.width / 2} y={-app.site.depth / 2} width={app.site.width} height={app.site.depth} />
    {/if}
    {#each app.site.assets as a (a.id)}
      {@const f = footprint(a.w, a.d, a.rot)}
      <rect class="asset" class:out={outIds.has(a.id)} x={a.x - f[0] / 2} y={a.z - f[1] / 2} width={f[0]} height={f[1]} />
    {/each}
  </svg>
  <div class="legend">
    <span><i class="lnew"></i>ผังใหม่</span>
    {#if changed}<span><i class="lold"></i>ผังเดิม</span>{/if}
    <span><i class="las"></i>เครื่อง</span>
    {#if outside.length}<span><i class="lout"></i>หลุดขอบ</span>{/if}
  </div>
</div>
<p class="hint">ผังขยายหรือหดจากกึ่งกลาง เครื่องที่วางไว้อยู่ที่เดิม · ขนาด {SITE_MIN}–{SITE_MAX} ม.</p>

{#if outside.length}
  <p class="warn">เครื่อง {outside.length} ตัวจะหลุดขอบผัง ({outside.slice(0, 3).map((a) => a.name).join(', ')}{outside.length > 3 ? ' …' : ''}) ย้ายเข้ามาก่อน หรือขยายผังให้ใหญ่ขึ้น</p>
{/if}

<style>
  h2 { margin: 0; font-size: 19px; color: #0f172a; }
  .sub { margin: 4px 0 22px; font-size: 13px; color: #64748b; }
  .field { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
  .field > label, .lbl { font-size: 13px; font-weight: 600; color: #334155; }
  input {
    font: 14px system-ui, sans-serif; color: #0f172a; padding: 9px 12px; border: 1px solid #e2e8f0;
    border-radius: 8px; min-width: 0; box-sizing: border-box; background: #fff;
  }
  #st-name { max-width: 420px; }
  input:focus { outline: none; border-color: #93c5fd; box-shadow: 0 0 0 3px #dbeafe; }
  input.bad { border-color: #fca5a5; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip {
    display: flex; flex-direction: column; align-items: flex-start; gap: 1px; padding: 8px 14px; min-width: 96px;
    border: 1px solid #e2e8f0; background: #fff; border-radius: 10px; cursor: pointer; font-family: system-ui, sans-serif;
  }
  .chip b { font-size: 13px; color: #0f172a; font-weight: 600; }
  .chip small { font-size: 11.5px; color: #64748b; }
  .chip:hover { border-color: #cbd5e1; background: #f8fafc; }
  .chip.on { border-color: #3b82f6; background: #eff6ff; box-shadow: 0 0 0 1px #3b82f6; }
  .chip.on b { color: #1d4ed8; }
  .size { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; }
  .size label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #64748b; }
  .unit { position: relative; display: block; }
  .unit input { width: 110px; padding-right: 32px; }
  .unit em { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-style: normal; font-size: 12px; color: #94a3b8; }
  .times { padding-bottom: 10px; color: #94a3b8; }
  .area { padding-bottom: 10px; margin-left: 6px; font-size: 12.5px; color: #64748b; }
  .preview { border: 1px solid #eef2f6; border-radius: 12px; background: #f8fafc; padding: 14px; }
  .preview svg { display: block; width: 100%; height: 220px; }
  .new { fill: #e0ecff; stroke: #3b82f6; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  .old { fill: none; stroke: #94a3b8; stroke-width: 1.2; stroke-dasharray: 5 4; vector-effect: non-scaling-stroke; }
  .asset { fill: #475569; }
  .asset.out { fill: #dc2626; }
  .legend { display: flex; gap: 14px; margin-top: 10px; font-size: 12px; color: #64748b; flex-wrap: wrap; }
  .legend span { display: flex; align-items: center; gap: 6px; }
  .legend i { width: 14px; height: 10px; border-radius: 2px; }
  .lnew { background: #e0ecff; border: 1.5px solid #3b82f6; }
  .lold { border: 1.5px dashed #94a3b8; }
  .las { background: #475569; }
  .lout { background: #dc2626; }
  .hint { margin: 10px 0 0; font-size: 12px; color: #94a3b8; }
  .warn { margin: 12px 0 0; font-size: 13px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 12px; }
</style>
