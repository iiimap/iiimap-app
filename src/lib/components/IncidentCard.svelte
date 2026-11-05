<script lang="ts">
  // การ์ดเรื่อง Andon 1 เรื่อง: แสดงเวลา + ปุ่มตามขั้นตอน (รับเรื่อง → ส่งต่อ → ปิดเรื่อง)
  import type { Incident } from '../domain/types';
  import { stageOf, STAGE_LABEL, fmtDuration } from '../domain/incident';
  import { app, actions, clock } from '../stores/site.svelte';
  import { guarded } from '../stores/guarded';

  let { incident, showAsset = true }: { incident: Incident; showAsset?: boolean } = $props();

  let stage = $derived(stageOf(incident));
  let state = $derived(app.site.andonStates.find((s) => s.id === incident.stateId));
  let asset = $derived(app.site.assets.find((a) => a.id === incident.assetId));
  let line = $derived(app.site.lines.find((l) => l.id === incident.lineId));
  let elapsed = $derived((incident.resolvedAt ?? clock.now) - incident.openedAt);

  let closing = $state(false);
  let reason = $state('');

  function resolve() {
    if (!reason) return;
    actions.resolveIncident(incident.id, reason);
    closing = false;
    reason = '';
  }
</script>

<div class="inc {stage}" style="--c:{state?.color ?? '#94a3b8'}">
  <div class="top">
    <span class="state"><i></i>{state?.name ?? incident.stateId}</span>
    <span class="time" title="เวลาตั้งแต่เปิดเรื่อง">{fmtDuration(elapsed)}</span>
  </div>
  {#if showAsset}
    <button class="asset" onclick={() => asset && (app.selectedId = asset.id)} disabled={!asset}>
      {asset?.name ?? '(เครื่องถูกลบ)'}{#if line}<small> · {line.name}</small>{/if}
    </button>
  {/if}

  <ol class="steps" aria-label="ขั้นตอน">
    <li class="done">แจ้ง</li>
    <li class:done={incident.ackAt !== null}>รับเรื่อง</li>
    <li class:done={incident.escalatedAt !== null} class:skip={incident.escalatedAt === null && stage === 'resolved'}>ส่งต่อ</li>
    <li class:done={stage === 'resolved'}>ปิดเรื่อง</li>
  </ol>
  <p class="stage">{STAGE_LABEL[stage]}{#if incident.reason} · {incident.reason}{/if}</p>

  {#if stage !== 'resolved'}
    {#if closing}
      <div class="close">
        <select bind:value={reason} aria-label="สาเหตุ">
          <option value="" disabled>เลือกสาเหตุ…</option>
          {#each app.site.reasons as r}
            <option value={r}>{r}</option>
          {/each}
        </select>
        <div class="row">
          <button class="ghost" onclick={() => { closing = false; reason = ''; }}>กลับ</button>
          <button class="primary" disabled={!reason} onclick={resolve}>ยืนยันปิดเรื่อง</button>
        </div>
      </div>
    {:else}
      <div class="row">
        {#if incident.ackAt === null}
          <button class="primary" onclick={() => actions.ackIncident(incident.id)}>รับเรื่อง</button>
        {/if}
        {#if incident.escalatedAt === null}
          <button class="warn" onclick={() => actions.escalateIncident(incident.id)}>ส่งต่อ</button>
        {/if}
        <button class="ok" onclick={() => (closing = true)}>ปิดเรื่อง</button>
      </div>
      <button class="cancel" onclick={() => guarded.cancelIncident(incident.id)}>แจ้งผิด / ยกเลิกเรื่อง</button>
    {/if}
  {/if}
</div>

<style>
  .inc {
    display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: 10px;
    border: 1px solid #e5e7eb; border-left: 4px solid var(--c); background: #fff; font-family: system-ui, sans-serif;
  }
  .inc.open { background: color-mix(in srgb, var(--c) 7%, white); }
  .top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .state { display: flex; align-items: center; gap: 6px; font: 600 13px system-ui, sans-serif; color: #0f172a; }
  .state i { width: 10px; height: 10px; border-radius: 50%; background: var(--c); }
  .open .state i { animation: blink 0.9s infinite; }
  @keyframes blink { 50% { opacity: 0.25; } }
  .time { font: 700 15px ui-monospace, monospace; color: #0f172a; }
  .asset { align-self: flex-start; border: 0; background: none; padding: 0; font: 600 13px system-ui, sans-serif; color: #1d4ed8; cursor: pointer; }
  .asset small { color: #64748b; font-weight: 500; }
  .asset:disabled { color: #94a3b8; cursor: default; }
  .steps { list-style: none; display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; margin: 2px 0 0; padding: 0; }
  .steps li { text-align: center; font-size: 10.5px; color: #94a3b8; padding-top: 5px; border-top: 3px solid #e2e8f0; }
  .steps li.done { color: #0f172a; border-top-color: var(--c); }
  .steps li.skip { text-decoration: line-through; }
  .stage { margin: 0; font-size: 11.5px; color: #64748b; }
  .row { display: flex; gap: 6px; flex-wrap: wrap; }
  .row button { flex: 1; }
  button.primary, button.warn, button.ok, button.ghost {
    border-radius: 7px; padding: 7px 8px; font: 600 12px system-ui, sans-serif; cursor: pointer; white-space: nowrap;
  }
  .primary { border: 0; background: #2563eb; color: #fff; }
  .primary:disabled { opacity: 0.4; cursor: default; }
  .warn { border: 1px solid #fdba74; background: #fff7ed; color: #c2410c; }
  .ok { border: 1px solid #86efac; background: #f0fdf4; color: #15803d; }
  .ghost { border: 1px solid #e2e8f0; background: #fff; color: #334155; }
  .cancel { align-self: flex-start; border: 0; background: none; padding: 0; font: 11.5px system-ui, sans-serif; color: #94a3b8; cursor: pointer; }
  .cancel:hover { color: #dc2626; text-decoration: underline; }
  .close { display: flex; flex-direction: column; gap: 6px; }
  .close select { font: 13px system-ui, sans-serif; padding: 7px 8px; border: 1px solid #e2e8f0; border-radius: 7px; background: #fff; }
</style>
