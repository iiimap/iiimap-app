<script lang="ts">
  // แท็บถังดับเพลิง: รายการถังทั้งหมด เรียงตามความเร่งด่วน + ตรวจได้จากตรงนี้
  import { app, actions, clock, focusAsset } from '../../stores/site.svelte';
  import { auditSummary, AUDIT_STATUS_COLOR, AUDIT_STATUS_LABEL, fmtDate, fmtDaysLeft, type AuditStatus } from '../../domain/audit';
  import AuditHistory from './AuditHistory.svelte';

  const ORDER: AuditStatus[] = ['overdue', 'failed', 'never', 'soon', 'ok'];
  let editable = $derived(app.mode === 'edit');
  let filter = $state<AuditStatus | 'all'>('all');
  let openId = $state<string | null>(null);
  let rows = $derived(
    app.site.assets
      .filter((a) => a.kind === 'extinguisher')
      .map((a) => ({ a, s: auditSummary(app.site, 'fire', a.id, clock.minute) }))
      .sort((x, y) => ORDER.indexOf(x.s.status) - ORDER.indexOf(y.s.status) || (x.s.nextDue ?? 0) - (y.s.nextDue ?? 0) || x.a.name.localeCompare(y.a.name, 'th', { numeric: true }))
  );
  let counts = $derived(Object.fromEntries(ORDER.map((st) => [st, rows.filter((r) => r.s.status === st).length])) as Record<AuditStatus, number>);
  let shown = $derived(filter === 'all' ? rows : rows.filter((r) => r.s.status === filter));

  function pick(id: string) {
    openId = openId === id ? null : id;
    if (openId) focusAsset(id);
  }
</script>

<aside class="panel">
  <header>
    <h3>ถังดับเพลิง <span class="count">{rows.length}</span></h3>
    {#if editable}
      <button class="primary" onclick={() => actions.startPlacing('extinguisher')}>+ วางถัง</button>
    {/if}
  </header>

  <div class="chips">
    <button class:on={filter === 'all'} onclick={() => (filter = 'all')}>ทั้งหมด {rows.length}</button>
    {#each ORDER as st}
      {#if counts[st]}
        <button class:on={filter === st} style="--c:{AUDIT_STATUS_COLOR[st]}" onclick={() => (filter = filter === st ? 'all' : st)}>
          <i></i>{AUDIT_STATUS_LABEL[st]} {counts[st]}
        </button>
      {/if}
    {/each}
  </div>

  <div class="scroll">
    {#if rows.length === 0}
      <p class="empty">ยังไม่มีถังดับเพลิงบนผัง{#if editable}<br />กด <b>+ วางถัง</b> แล้วคลิกบนผัง{/if}</p>
    {/if}
    {#each shown as r (r.a.id)}
      <section class="card" class:open={openId === r.a.id} style="--c:{AUDIT_STATUS_COLOR[r.s.status]}">
        <button class="sum" onclick={() => pick(r.a.id)}>
          <span class="name">{r.a.name}</span>
          <span class="st"><i></i>{AUDIT_STATUS_LABEL[r.s.status]}</span>
          <span class="meta">ตรวจแล้ว <b>{r.s.count}</b> ครั้ง</span>
          <span class="meta right">{#if r.s.nextDue}ครั้งถัดไป {fmtDate(r.s.nextDue)} · {fmtDaysLeft(r.s.daysLeft)}{:else}ยังไม่มีกำหนด{/if}</span>
        </button>
        {#if openId === r.a.id}
          <div class="body">
            {#if r.s.last}<p class="last">ตรวจล่าสุด {fmtDate(r.s.last.at)} โดย {r.s.last.inspector}</p>{/if}
            <button class="audit" onclick={() => actions.openAuditForm('fire', r.a.id)}>✓ บันทึกการตรวจ</button>
            <AuditHistory module="fire" targetId={r.a.id} />
          </div>
        {/if}
      </section>
    {/each}

    <section class="settings">
      <button class="toggle" onclick={() => (app.settings = 'fire')}>⚙ ตั้งค่าการตรวจ (ทุก {app.site.auditConfig.fire.intervalDays} วัน)</button>
    </section>
  </div>
</aside>

<style>
  .panel {
    position: absolute; top: 16px; left: 16px; bottom: 16px; width: 330px; z-index: 3;
    display: flex; flex-direction: column; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06); font-family: system-ui, sans-serif; overflow: hidden;
  }
  header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 8px; }
  h3 { margin: 0; font-size: 14px; color: #0f172a; }
  .count { font-size: 11px; color: #475569; background: #f1f5f9; border-radius: 999px; padding: 1px 8px; margin-left: 4px; }
  .primary { border: 0; background: #2563eb; color: #fff; border-radius: 7px; padding: 6px 10px; font: 600 12px system-ui, sans-serif; cursor: pointer; }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; padding: 0 14px 10px; border-bottom: 1px solid #f1f5f9; }
  .chips button { display: flex; align-items: center; gap: 5px; border: 1px solid #e2e8f0; background: #fff; border-radius: 999px; padding: 3px 9px; font: 11.5px system-ui, sans-serif; color: #334155; cursor: pointer; }
  .chips button.on { border-color: #2563eb; background: #eff6ff; color: #1d4ed8; font-weight: 600; }
  .chips i { width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
  .scroll { overflow-y: auto; padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 6px; }
  .empty { margin: 16px; text-align: center; font-size: 13px; line-height: 1.7; color: #64748b; }

  .card { border: 1px solid #e5e7eb; border-left: 4px solid var(--c); border-radius: 9px; background: #fff; }
  .card.open { border-color: #93c5fd; border-left-color: var(--c); box-shadow: 0 0 0 1px #93c5fd; }
  .sum { width: 100%; display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; padding: 9px 10px; border: 0; background: transparent; cursor: pointer; text-align: left; font-family: system-ui, sans-serif; }
  .name { font: 600 14px system-ui, sans-serif; color: #0f172a; }
  .st { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #334155; justify-self: end; }
  .st i { width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
  .meta { font-size: 11.5px; color: #64748b; }
  .meta b { color: #0f172a; }
  .meta.right { justify-self: end; text-align: right; }
  .body { display: flex; flex-direction: column; gap: 8px; padding: 0 10px 10px; }
  .last { margin: 0; font-size: 12px; color: #475569; }
  .audit { border: 0; background: #16a34a; color: #fff; border-radius: 7px; padding: 8px; font: 600 13px system-ui, sans-serif; cursor: pointer; }
  .audit:hover { background: #15803d; }
  .settings { margin-top: 6px; padding-top: 8px; border-top: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 8px; }
  .toggle { align-self: flex-start; border: 0; background: none; padding: 0; font: 600 12px system-ui, sans-serif; color: #475569; cursor: pointer; }
</style>
