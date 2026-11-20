<script lang="ts">
  // แท็บ 5ส: คะแนนล่าสุดรายไลน์ + ตรวจได้จากตรงนี้
  import { app, actions, clock, focusLine } from '../../stores/site.svelte';
  import { auditSummary, AUDIT_STATUS_COLOR, AUDIT_STATUS_LABEL, fiveSColor, fmtDate, fmtDaysLeft } from '../../domain/audit';
  import AuditHistory from './AuditHistory.svelte';

  let pass = $derived(app.site.auditConfig.fiveS.passScore);

  let rows = $derived(
    app.site.lines
      .filter((l) => l.id !== app.draftLineId)
      .map((l) => ({ l, s: auditSummary(app.site, 'fiveS', l.id, clock.minute) }))
      .sort((a, b) => a.l.name.localeCompare(b.l.name, 'th', { numeric: true }))
  );
  let avg = $derived.by(() => {
    const scored = rows.filter((r) => r.s.last?.score != null);
    return scored.length ? Math.round((scored.reduce((s, r) => s + (r.s.last!.score ?? 0), 0) / scored.length) * 10) / 10 : null;
  });

  function pick(id: string) {
    app.fiveSLineId = app.fiveSLineId === id ? null : id;
    if (app.fiveSLineId) focusLine(id);
  }
</script>

<aside class="panel">
  <header>
    <h3>5ส รายไลน์</h3>
    {#if avg !== null}<span class="avg" style="--c:{fiveSColor(avg, pass)}">เฉลี่ย <b>{avg}%</b></span>{/if}
  </header>

  <div class="scroll">
    {#if rows.length === 0}
      <p class="empty">ยังไม่มีไลน์<br />สร้างไลน์ในแท็บ <b>Line</b> ก่อน แล้วค่อยตรวจ 5ส รายไลน์</p>
    {/if}
    {#each rows as r (r.l.id)}
      {@const score = r.s.last?.score ?? null}
      <section class="card" class:open={app.fiveSLineId === r.l.id} style="--lc:{r.l.color}; --sc:{fiveSColor(score, pass)}">
        <button class="sum" onclick={() => pick(r.l.id)}>
          <span class="name">{r.l.name}</span>
          <span class="score">{score === null ? '–' : `${score}%`}</span>
          <span class="bar"><i style="width:{score ?? 0}%"></i></span>
          <span class="st" style="--c:{AUDIT_STATUS_COLOR[r.s.status]}"><i></i>{AUDIT_STATUS_LABEL[r.s.status]} · ตรวจแล้ว {r.s.count} ครั้ง</span>
          <span class="meta">{#if r.s.nextDue}ครั้งถัดไป {fmtDate(r.s.nextDue)} · {fmtDaysLeft(r.s.daysLeft)}{:else}ยังไม่มีกำหนด{/if}</span>
        </button>
        {#if app.fiveSLineId === r.l.id}
          <div class="body">
            {#if r.s.last}
              <div class="cats">
                {#each app.site.auditConfig.fiveS.categories as c}
                  <span>{c} <b>{r.s.last.scores[c] ?? '–'}</b>/5</span>
                {/each}
              </div>
            {/if}
            <button class="audit" onclick={() => actions.openAuditForm('fiveS', r.l.id)}>✓ ตรวจ 5ส ไลน์นี้</button>
            <AuditHistory module="fiveS" targetId={r.l.id} />
          </div>
        {/if}
      </section>
    {/each}

    <section class="settings">
      <button class="toggle" onclick={() => (app.settings = 'fiveS')}>⚙ ตั้งค่าการตรวจ (ทุก {app.site.auditConfig.fiveS.intervalDays} วัน · ผ่าน {pass}%)</button>
    </section>
  </div>
</aside>

<style>
  .panel {
    position: absolute; top: 16px; left: 16px; bottom: 16px; width: 330px; z-index: 3;
    display: flex; flex-direction: column; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06); font-family: system-ui, sans-serif; overflow: hidden;
  }
  header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 10px; border-bottom: 1px solid #f1f5f9; }
  h3 { margin: 0; font-size: 14px; color: #0f172a; }
  .avg { font-size: 12px; color: #475569; border-left: 3px solid var(--c); padding-left: 6px; }
  .avg b { color: #0f172a; font-size: 14px; }
  .scroll { overflow-y: auto; padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 6px; }
  .empty { margin: 16px; text-align: center; font-size: 13px; line-height: 1.7; color: #64748b; }

  .card { border: 1px solid #e5e7eb; border-left: 4px solid var(--lc); border-radius: 9px; background: #fff; }
  .card.open { border-color: #93c5fd; border-left-color: var(--lc); box-shadow: 0 0 0 1px #93c5fd; }
  .sum { width: 100%; display: grid; grid-template-columns: 1fr auto; gap: 4px 8px; padding: 9px 10px; border: 0; background: transparent; cursor: pointer; text-align: left; font-family: system-ui, sans-serif; }
  .name { font: 600 14px system-ui, sans-serif; color: #0f172a; }
  .score { font: 700 18px system-ui, sans-serif; color: var(--sc); justify-self: end; }
  .bar { grid-column: 1 / -1; height: 6px; border-radius: 999px; background: #f1f5f9; overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--sc); border-radius: 999px; }
  .st { grid-column: 1 / -1; display: flex; align-items: center; gap: 5px; font-size: 11.5px; color: #475569; }
  .st i { width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
  .meta { grid-column: 1 / -1; font-size: 11.5px; color: #64748b; }
  .body { display: flex; flex-direction: column; gap: 8px; padding: 0 10px 10px; }
  .cats { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 10px; font-size: 12px; color: #475569; }
  .cats b { color: #0f172a; }
  .audit { border: 0; background: #16a34a; color: #fff; border-radius: 7px; padding: 8px; font: 600 13px system-ui, sans-serif; cursor: pointer; }
  .audit:hover { background: #15803d; }
  .settings { margin-top: 6px; padding-top: 8px; border-top: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 8px; }
  .toggle { align-self: flex-start; border: 0; background: none; padding: 0; font: 600 12px system-ui, sans-serif; color: #475569; cursor: pointer; }
</style>
