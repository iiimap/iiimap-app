<script lang="ts">
  // แผง Andon: เรื่องที่เปิดอยู่ (หน้าไลน์) + ประวัติ + ตั้งค่าสถานะ/สี + สาเหตุ (KPI อยู่ในแท็บ KPIs)
  import { app, actions } from '../../stores/site.svelte';
  import { guarded } from '../../stores/guarded';
  import IncidentCard from '../IncidentCard.svelte';
  import { fmtDuration, fmtTime } from '../../domain/incident';

  let open = $derived(
    app.site.incidents.filter((i) => i.resolvedAt === null).sort((a, b) => Number(a.ackAt !== null) - Number(b.ackAt !== null) || a.openedAt - b.openedAt)
  );
  let recent = $derived(app.site.incidents.filter((i) => i.resolvedAt !== null).slice(-10).reverse());
  const assetName = (id: string) => app.site.assets.find((a) => a.id === id)?.name ?? '(ถูกลบ)';
  const stateOf = (id: string) => app.site.andonStates.find((s) => s.id === id);

  let editable = $derived(app.mode === 'edit');
  let nonSystem = $derived(app.site.andonStates.filter((s) => !s.system).length);

  let usedBy = $derived(
    Object.fromEntries(app.site.andonStates.map((s) => [s.id, app.site.assets.filter((a) => a.andon && a.status === s.id).length]))
  );
</script>

<aside class="panel">
  <header><h3>Andon</h3></header>

  <div class="scroll">
    <section>
      <h4>Andon ที่ยังไม่ปิด <span class="count" class:alert={open.length > 0}>{open.length}</span></h4>
      {#if open.length === 0}
        <p class="hint">ไม่มีเรื่องค้าง · แจ้ง Andon ได้จากแผงคุณสมบัติของเครื่อง (คลิกเครื่องบนผัง)</p>
      {:else}
        <div class="board">
          {#each open as inc (inc.id)}
            <IncidentCard incident={inc} />
          {/each}
        </div>
      {/if}
    </section>

    {#if recent.length}
      <section>
        <h4>ปิดเรื่องล่าสุด</h4>
        <ul class="hist">
          {#each recent as inc (inc.id)}
            <li>
              <i style="background:{stateOf(inc.stateId)?.color ?? '#94a3b8'}"></i>
              <b>{assetName(inc.assetId)}</b>
              <span>{stateOf(inc.stateId)?.name ?? inc.stateId} · {inc.reason}</span>
              <small>{fmtTime(inc.openedAt)} · {fmtDuration((inc.resolvedAt ?? inc.openedAt) - inc.openedAt)}</small>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section>
      <h4>สถานะและสี</h4>
      <p class="hint">ตั้งชื่อและสีได้ตามมาตรฐานของโรงงาน · <b>ระดับ 0–9</b> (0 = ปกติ) ยิ่งสูงยิ่งร้ายแรง ใช้ตัดสินสีรวมของไลน์แบบ ByLine</p>

      <div class="states">
        <div class="row th"><span>สี</span><span>ความหมาย</span><span>ระดับ</span><span></span></div>
        {#each app.site.andonStates as st (st.id)}
          <div class="row">
            <input class="swatch" type="color" bind:value={st.color} disabled={!editable}
              onfocus={() => actions.beginEdit()} onchange={() => actions.commitEdit()} />
            <input class="txt" bind:value={st.name} disabled={!editable}
              onfocus={() => actions.beginEdit()} onchange={() => actions.commitEdit()} />
            {#if st.system}
              <span class="sys" title="สถานะของระบบ: ใช้เมื่อเครื่องขาดการเชื่อมต่อ ไม่มีระดับ ลบไม่ได้ และไม่นับในสีรวมของไลน์ (ยกเว้นทั้งไลน์ขาดการเชื่อมต่อหมด)">🔒 ระบบ</span>
              <span></span>
            {:else}
              <input class="num" type="number" min="0" max="9" step="1" value={st.severity} disabled={!editable}
                onchange={(e) => { actions.setSeverity(st.id, +e.currentTarget.value); e.currentTarget.value = String(st.severity); }} />
              {#if editable}
                <button class="icon" title={usedBy[st.id] ? `ลบ (เครื่อง ${usedBy[st.id]} ตัวจะกลับเป็นสถานะระดับต่ำสุด)` : 'ลบ'}
                  disabled={nonSystem <= 1} onclick={() => guarded.deleteAndonState(st.id)}>×</button>
              {:else}<span></span>{/if}
            {/if}
          </div>
        {/each}
      </div>

      {#if editable}
        <div class="btns">
          <button onclick={() => actions.addAndonState()}>+ เพิ่มสถานะ</button>
          <button class="ghost" onclick={() => guarded.resetAndonStates()}>คืนค่าเริ่มต้น</button>
        </div>
      {/if}
    </section>

    <section>
      <h4>สาเหตุ (เลือกตอนปิดเรื่อง)</h4>
      <div class="reasons">
        {#each app.site.reasons as _, i}
          <div class="rrow">
            <input class="txt" bind:value={app.site.reasons[i]} disabled={!editable}
              onfocus={() => actions.beginEdit()} onchange={() => actions.commitEdit()} />
            {#if editable}
              <button class="icon" title="ลบสาเหตุ" onclick={() => guarded.removeReason(i)}>×</button>
            {/if}
          </div>
        {/each}
      </div>
      {#if editable}
        <div class="btns">
          <button onclick={() => actions.addReason()}>+ เพิ่มสาเหตุ</button>
          <button class="ghost" onclick={() => guarded.resetReasons()}>คืนค่าเริ่มต้น</button>
        </div>
      {/if}
    </section>

    <p class="note">ตัวชี้วัด เช่น MTTR / MTBF และสถานะที่นับเป็น "เสีย" ย้ายไปอยู่ที่แท็บ <b>KPIs</b></p>
  </div>
</aside>

<style>
  .panel {
    position: absolute; top: 16px; left: 16px; bottom: 16px; width: 330px; z-index: 3;
    display: flex; flex-direction: column; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06); font-family: system-ui, sans-serif; overflow: hidden;
  }
  header { padding: 12px 14px 8px; border-bottom: 1px solid #f1f5f9; }
  h3 { margin: 0; font-size: 14px; color: #0f172a; }
  .scroll { overflow-y: auto; padding: 4px 14px 14px; }
  section { padding: 8px 0 12px; border-bottom: 1px solid #f1f5f9; }
  section:last-child { border-bottom: 0; }
  h4 { margin: 8px 0 4px; font-size: 12px; font-weight: 600; color: #334155; }
  .hint { margin: 0 0 8px; font-size: 11.5px; line-height: 1.6; color: #64748b; }

  .states { display: flex; flex-direction: column; gap: 4px; }
  .row { display: grid; grid-template-columns: 28px 1fr 56px 24px; gap: 6px; align-items: center; }
  .row.th span { font-size: 11px; color: #94a3b8; }
  .swatch { width: 26px; height: 26px; padding: 0; border: 0; background: none; cursor: pointer; }
  .txt, .num, .formula input {
    font: 13px system-ui, sans-serif; padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 6px; min-width: 0; color: #0f172a;
  }
  .txt:focus, .num:focus, .formula input:focus { outline: none; border-color: #93c5fd; box-shadow: 0 0 0 2px #dbeafe; }
  input:disabled { background: #f8fafc; color: #475569; }
  .sys { font-size: 11px; color: #64748b; background: #f1f5f9; border-radius: 6px; padding: 5px 4px; text-align: center; cursor: help; white-space: nowrap; }
  .count { font-size: 11px; color: #475569; background: #f1f5f9; border-radius: 999px; padding: 1px 8px; margin-left: 4px; }
  .count.alert { color: #fff; background: #dc2626; }
  .board { display: flex; flex-direction: column; gap: 8px; }
  .hist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .hist li { display: grid; grid-template-columns: 10px auto 1fr; column-gap: 6px; align-items: baseline; font-size: 12px; color: #475569; }
  .hist i { width: 8px; height: 8px; border-radius: 50%; }
  .hist b { color: #0f172a; }
  .hist span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hist small { grid-column: 2 / -1; font-size: 11px; color: #94a3b8; }
  .reasons { display: flex; flex-direction: column; gap: 4px; }
  .rrow { display: grid; grid-template-columns: 1fr 24px; gap: 6px; align-items: center; }
  .icon { border: 0; background: transparent; color: #94a3b8; font-size: 16px; cursor: pointer; border-radius: 6px; height: 26px; }
  .icon:hover:not(:disabled) { background: #fef2f2; color: #dc2626; }
  .icon:disabled { opacity: 0.3; cursor: default; }

  .btns { display: flex; gap: 6px; margin-top: 8px; }
  .btns button { border: 1px solid #e2e8f0; background: #fff; border-radius: 7px; padding: 6px 10px; font: 12px system-ui, sans-serif; color: #1e293b; cursor: pointer; }
  .btns button:hover { background: #f8fafc; }
  .btns .ghost { color: #64748b; }

  .formula { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
  .fl { font-size: 12px; color: #64748b; }
  .fl b { color: #0f172a; }
  .formula input { font-family: ui-monospace, monospace; }
  .formula input.bad { border-color: #fca5a5; }
  .err { font-size: 11.5px; color: #dc2626; }
  .ok { font-size: 11.5px; color: #64748b; }
  .ok b { color: #16a34a; }

  .vars { display: flex; flex-direction: column; gap: 2px; margin: 4px 0 8px; }
  .vars button { display: flex; align-items: baseline; gap: 8px; text-align: left; border: 1px solid transparent; background: #f8fafc; border-radius: 6px; padding: 4px 8px; cursor: pointer; }
  .vars button:hover:not(:disabled) { border-color: #bfdbfe; background: #eff6ff; }
  .vars button:disabled { cursor: default; }
  .vars code { font-size: 12px; color: #1d4ed8; }
  .vars span { font-size: 11.5px; color: #64748b; }

  .checks { display: flex; flex-direction: column; gap: 4px; }
  .checks label { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #1e293b; }
  .dot { width: 10px; height: 10px; border-radius: 50%; }
  .note { margin: 10px 0 0; font-size: 11px; line-height: 1.6; color: #94a3b8; }
</style>
