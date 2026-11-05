<script lang="ts">
  import { MODELS, CATEGORIES } from '../domain/catalog';
  import { app, actions, andonColors } from '../stores/site.svelte';
  import { guarded } from '../stores/guarded';
  import { activeIncident } from '../stores/site.svelte';
  import IncidentCard from './IncidentCard.svelte';

  let asset = $derived(app.site.assets.find((a) => a.id === app.selectedId));
  let base = $derived(asset ? MODELS[asset.kind] : null);
  let category = $derived(CATEGORIES.find((c) => c.id === base?.category)?.label ?? '');
  let editable = $derived(app.mode === 'edit');
  let line = $derived(asset?.lineId ? app.site.lines.find((l) => l.id === asset!.lineId) : undefined);
  let shown = $derived(asset ? andonColors(app.site)[asset.id] : undefined);
  // สถานะที่แจ้งได้ = ทุกสถานะที่ระดับมากกว่า 0 (ไม่รวมสถานะปกติและสถานะของระบบ)
  let raisable = $derived(app.site.andonStates.filter((s) => !s.system && s.severity > 0));
  // ขยายมาแล้วกี่ครั้ง (0 = ขนาด default)
  let level = $derived(asset && base ? asset.w - base.w : 0);

  function onLineChange(e: Event) {
    if (!asset) return;
    const sel = e.currentTarget as HTMLSelectElement;
    const v = sel.value;
    sel.value = asset.lineId ?? ''; // คืนค่าเดิมไว้ก่อน รอผลจากหน้าต่างถามย้ำ
    if (v) guarded.addToLine(asset.id, v);
    else guarded.removeFromLine(asset.id);
  }
</script>

{#if asset && base && !app.lineAddMode}
  <aside class="props">
    <div class="head">
      <span class="kind">{category} · {base.label}</span>
      <button class="close" title="ปิด" onclick={() => (app.selectedId = null)}>×</button>
    </div>

    <label>
      ชื่อ
      <input bind:value={asset.name} disabled={!editable} onfocus={() => actions.beginEdit()} onchange={() => actions.commitEdit()} />
    </label>

    <label>
      ไลน์
      <select value={asset.lineId ?? ''} disabled={!editable} onchange={onLineChange}>
        <option value="">— ไม่อยู่ในไลน์ —</option>
        {#each app.site.lines as l (l.id)}
          <option value={l.id}>{l.name}</option>
        {/each}
      </select>
    </label>

    <div class="size">
      <span class="lbl">ขนาด · default {base.w} × {base.d} ม.</span>
      <div class="stepper">
        <button title="ลดขนาด 1 ม." disabled={!editable || level <= 0} onclick={() => actions.grow(asset!.id, -1)}>−</button>
        <b>{asset.w} × {asset.d} ม.</b>
        <button title="ขยายขนาด 1 ม." disabled={!editable} onclick={() => actions.grow(asset!.id, 1)}>+</button>
      </div>
    </div>

    <div class="andon">
      <div class="arow">
        <span class="lbl">Andon</span>
        {#if base.andon === 'none'}
          <span class="na">ประเภทนี้ไม่มี Andon</span>
        {:else}
          <label class="switch" title={editable ? '' : 'สลับเป็นโหมดแก้ไขผังเพื่อเปิด/ปิด'}>
            <input type="checkbox" checked={asset.andon} disabled={!editable}
              onchange={(e) => actions.setAndon(asset!.id, e.currentTarget.checked)} />
            <span class="track"><span class="thumb"></span></span>
            <span>{asset.andon ? 'เปิด' : 'ปิด'}</span>
          </label>
        {/if}
      </div>

      {#if asset.andon}
        {@const inc = activeIncident(asset.id)}
        {@const cur = app.site.andonStates.find((x) => x.id === asset!.status)}
        <p class="cur">
          <span class="dot" style="background:{cur?.color ?? '#94a3b8'}"></span>
          สถานะตอนนี้: <b>{cur?.name ?? '-'}</b>
        </p>
        {#if inc}
          <IncidentCard incident={inc} showAsset={false} />
        {:else}
          <span class="lbl">แจ้ง Andon</span>
          <div class="states">
            {#each raisable as st (st.id)}
              <button style="--c:{st.color}" disabled={cur?.system === 'offline'} onclick={() => actions.raiseAndon(asset!.id, st.id)}>
                <span class="dot"></span>{st.name}
              </button>
            {/each}
          </div>
          <button class="offline" onclick={() => actions.setOffline(asset!.id, cur?.system !== 'offline')}>
            {cur?.system === 'offline' ? '↺ กลับมาเชื่อมต่อแล้ว' : 'ตั้งเป็นขาดการเชื่อมต่อ'}
          </button>
        {/if}
        {#if line?.mode === 'byLine'}
          <p class="note">
            <span class="dot" style="background:{shown}"></span>
            {line.name} เป็นแบบ ByLine: ไฟแสดงสถานะที่ร้ายแรงที่สุดของทั้งไลน์
          </p>
        {/if}
      {/if}
    </div>

    <p class="pos">ตำแหน่ง X {asset.x} · Z {asset.z} · หมุน {asset.rot * 90}°</p>

    {#if editable}
      <div class="actions">
        <button onclick={() => actions.rotate(asset!.id)}>⟳ หมุน 90°</button>
        <button class="danger" onclick={() => guarded.removeAsset(asset!.id)}>ลบ</button>
      </div>
    {/if}
  </aside>
{/if}

<style>
  .props {
    position: absolute; top: 16px; right: 16px; width: 260px; padding: 14px; z-index: 3;
    max-height: calc(100% - 32px); overflow-y: auto; box-sizing: border-box;
    background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
    font-family: system-ui, sans-serif; display: flex; flex-direction: column; gap: 10px;
  }
  .head { display: flex; align-items: center; justify-content: space-between; }
  .kind { font-size: 12px; font-weight: 600; color: #2563eb; background: #eff6ff; padding: 3px 8px; border-radius: 999px; }
  .close { border: 0; background: transparent; font-size: 20px; line-height: 1; color: #94a3b8; cursor: pointer; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #64748b; }
  input:not([type='checkbox']), select {
    font: 14px system-ui, sans-serif; color: #0f172a; padding: 7px 9px;
    border: 1px solid #e2e8f0; border-radius: 7px; background: #ffffff; min-width: 0;
  }
  input:focus, select:focus { outline: 2px solid #bfdbfe; border-color: #93c5fd; }
  input:disabled, select:disabled { background: #f8fafc; color: #475569; }

  .size { display: flex; flex-direction: column; gap: 6px; }
  .lbl { font-size: 12px; color: #64748b; }
  .stepper { display: grid; grid-template-columns: 34px 1fr 34px; align-items: center; gap: 6px; }
  .stepper b { text-align: center; font-weight: 600; color: #0f172a; font-variant-numeric: tabular-nums; font-size: 13px; }
  .stepper button {
    height: 34px; border: 1px solid #e2e8f0; border-radius: 7px; background: #ffffff;
    font-size: 16px; color: #334155; cursor: pointer;
  }
  .stepper button:hover:not(:disabled) { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
  .stepper button:disabled { opacity: 0.35; cursor: default; }

  .andon { display: flex; flex-direction: column; gap: 8px; padding-top: 8px; border-top: 1px solid #f1f5f9; }
  .arow { display: flex; align-items: center; justify-content: space-between; }
  .na { font-size: 12px; color: #94a3b8; }
  .switch { flex-direction: row; align-items: center; gap: 8px; cursor: pointer; font-size: 12.5px; color: #334155; }
  .switch input { position: absolute; opacity: 0; pointer-events: none; }
  .track { width: 34px; height: 20px; border-radius: 999px; background: #cbd5e1; position: relative; transition: background 0.15s; }
  .thumb { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: left 0.15s; box-shadow: 0 1px 2px rgba(0,0,0,.2); }
  .switch input:checked + .track { background: #16a34a; }
  .switch input:checked + .track .thumb { left: 16px; }
  .switch input:disabled + .track { opacity: 0.5; }
  .states { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .states button {
    display: flex; align-items: center; gap: 6px; padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 7px;
    background: #fff; font: 12px system-ui, sans-serif; color: #334155; cursor: pointer; text-align: left;
  }
  .states button:hover { border-color: var(--c); }
  .states button.on { border-color: var(--c); background: color-mix(in srgb, var(--c) 12%, white); color: #0f172a; font-weight: 600; }
  .states .dot { background: var(--c); }
  .states button:disabled { opacity: 0.4; cursor: default; }
  .cur { margin: 0; display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #475569; }
  .cur b { color: #0f172a; }
  .offline { align-self: flex-start; border: 0; background: none; padding: 0; font: 11.5px system-ui, sans-serif; color: #64748b; cursor: pointer; }
  .offline:hover { color: #0f172a; text-decoration: underline; }
  .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; display: inline-block; }
  .note { margin: 0; font-size: 11.5px; line-height: 1.5; color: #64748b; display: flex; gap: 6px; align-items: baseline; }

  .pos { margin: 0; font-size: 12px; color: #94a3b8; font-variant-numeric: tabular-nums; }
  .actions { display: flex; gap: 8px; }
  .actions button {
    flex: 1; padding: 8px; border-radius: 7px; border: 1px solid #e2e8f0;
    background: #ffffff; font: 500 13px system-ui, sans-serif; color: #334155; cursor: pointer;
  }
  .actions button:hover { background: #f8fafc; }
  .actions .danger { color: #dc2626; border-color: #fecaca; }
  .actions .danger:hover { background: #fef2f2; }
</style>
