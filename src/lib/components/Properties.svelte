<script lang="ts">
  import { MODELS, CATEGORIES, STATUS_LABEL } from '../domain/catalog';
  import type { AssetStatus } from '../domain/types';
  import { app, actions } from '../stores/site.svelte';

  let asset = $derived(app.site.assets.find((a) => a.id === app.selectedId));
  let base = $derived(asset ? MODELS[asset.kind] : null);
  let category = $derived(CATEGORIES.find((c) => c.id === base?.category)?.label ?? '');
  let editable = $derived(app.mode === 'edit');
  const statuses = Object.keys(STATUS_LABEL) as AssetStatus[];

  // ขยายมาแล้วกี่ครั้ง (0 = ขนาด default)
  let level = $derived(asset && base ? asset.w - base.w : 0);
</script>

{#if asset && base}
  <aside class="props">
    <div class="head">
      <span class="kind">{category} · {base.label}</span>
      <button class="close" title="ปิด" onclick={() => (app.selectedId = null)}>×</button>
    </div>

    <label>
      ชื่อ
      <input bind:value={asset.name} disabled={!editable} onfocus={() => actions.beginEdit()} onchange={() => actions.commitEdit()} />
    </label>

    <div class="size">
      <span class="lbl">ขนาด · default {base.w} × {base.d} ม.</span>
      <div class="stepper">
        <button title="ลดขนาด 1 ม." disabled={!editable || level <= 0} onclick={() => actions.grow(asset!.id, -1)}>−</button>
        <b>{asset.w} × {asset.d} ม.</b>
        <button title="ขยายขนาด 1 ม." disabled={!editable} onclick={() => actions.grow(asset!.id, 1)}>+</button>
      </div>
    </div>

    <label>
      สถานะ
      <select bind:value={asset.status} disabled={!editable} onfocus={() => actions.beginEdit()} onchange={() => actions.commitEdit()}>
        {#each statuses as s}
          <option value={s}>{STATUS_LABEL[s]}</option>
        {/each}
      </select>
    </label>

    <p class="pos">ตำแหน่ง X {asset.x} · Z {asset.z} · หมุน {asset.rot * 90}°</p>

    {#if editable}
      <div class="actions">
        <button onclick={() => actions.rotate(asset!.id)}>⟳ หมุน 90°</button>
        <button class="danger" onclick={() => actions.remove(asset!.id)}>ลบ</button>
      </div>
    {/if}
  </aside>
{/if}

<style>
  .props {
    position: absolute; top: 16px; right: 16px; width: 240px; z-index: 3; padding: 14px;
    background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
    font-family: system-ui, sans-serif; display: flex; flex-direction: column; gap: 10px;
  }
  .head { display: flex; align-items: center; justify-content: space-between; }
  .kind { font-size: 12px; font-weight: 600; color: #2563eb; background: #eff6ff; padding: 3px 8px; border-radius: 999px; }
  .close { border: 0; background: transparent; font-size: 20px; line-height: 1; color: #94a3b8; cursor: pointer; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #64748b; }
  input, select {
    font: 14px system-ui, sans-serif; color: #0f172a; padding: 7px 9px;
    border: 1px solid #e2e8f0; border-radius: 7px; background: #ffffff; min-width: 0;
  }
  input:focus, select:focus { outline: 2px solid #bfdbfe; border-color: #93c5fd; }
  input:disabled, select:disabled { background: #f8fafc; color: #475569; }

  .size { display: flex; flex-direction: column; gap: 6px; }
  .lbl { font-size: 12px; color: #64748b; }
  .stepper { display: grid; grid-template-columns: 34px 1fr 34px; align-items: center; gap: 6px; font-size: 13px; color: #475569; }
  .stepper b { text-align: center; font-weight: 600; color: #0f172a; font-variant-numeric: tabular-nums; }
  .stepper button {
    height: 34px; border: 1px solid #e2e8f0; border-radius: 7px; background: #ffffff;
    font-size: 16px; color: #334155; cursor: pointer;
  }
  .stepper button:hover:not(:disabled) { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
  .stepper button:disabled { opacity: 0.35; cursor: default; }

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
