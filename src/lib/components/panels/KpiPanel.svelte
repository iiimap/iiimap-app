<script lang="ts">
  // แท็บ KPIs: ดูค่า KPI (monitor) + สร้าง / แก้ไข KPI ผ่านฟอร์มที่ต้องกดบันทึก
  // กล่องตั้งค่าเปิดเฉพาะ KPI ที่เลือก คลิกที่อื่นแล้วปิด (ถ้ายังไม่บันทึก จะถามก่อน)
  import { METRIC_VARIABLES, checkFormula, evalFormula, SAMPLE_VALUES } from '../../domain/formula';
  import { PERIODS, KPI_UNITS, BETTER_LABEL, computeKpis, fmtNum } from '../../domain/kpi';
  import { app, actions, kpiFormDirty } from '../../stores/site.svelte';
  import { guarded } from '../../stores/guarded';

  let editable = $derived(app.mode === 'edit');
  let result = $derived(computeKpis(app.site, app.kpiScope, app.kpiPeriod));
  let scopeName = $derived(app.kpiScope === 'site' ? 'ทั้งโรงงาน' : (app.site.lines.find((l) => l.id === app.kpiScope)?.name ?? 'ทั้งโรงงาน'));
  let dirty = $derived(kpiFormDirty());

  // ไลน์ที่เลือกถูกลบไปแล้ว: กลับไปดูทั้งโรงงาน
  $effect(() => {
    if (app.kpiScope !== 'site' && !app.site.lines.some((l) => l.id === app.kpiScope)) app.kpiScope = 'site';
  });

  // หน่วยในดรอปดาวน์ (ถ้า KPI เดิมใช้หน่วยอื่น ก็แสดงไว้ให้เลือกด้วย)
  let units = $derived(
    app.kpiForm && !KPI_UNITS.some((u) => u.value === app.kpiForm!.unit)
      ? [...KPI_UNITS, { value: app.kpiForm.unit, label: app.kpiForm.unit }]
      : KPI_UNITS
  );

  function insertVar(id: string) {
    const f = app.kpiForm;
    if (!f) return;
    const cur = f.formula.trim();
    f.formula = cur ? `${cur} ${id}` : id;
    app.kpiError = '';
  }

  // คลิกนอกแผง = ปิดกล่องตั้งค่า (ถ้ามีการแก้ที่ยังไม่บันทึก จะถามก่อน)
  function onOutside(e: PointerEvent) {
    if (!app.kpiForm) return;
    if ((e.target as HTMLElement).closest('.kpipanel, .ribbon, .backdrop, .dd-panel')) return;
    guarded.closeKpiForm();
  }
</script>

<svelte:window onpointerdown={onOutside} />

{#snippet editor()}
  {#if app.kpiForm}
    {@const f = app.kpiForm}
    {@const err = f.formula.trim() ? checkFormula(f.formula) : 'ยังไม่ได้ใส่สูตร'}
    <div class="editor">
      <label>
        ชื่อ KPI
        <input bind:value={app.kpiForm.name} disabled={!editable} placeholder="เช่น MTTR" oninput={() => (app.kpiError = '')} />
      </label>
      <label>
        สูตร
        <input class="mono" class:bad={!!err && !!f.formula.trim()} bind:value={app.kpiForm.formula} disabled={!editable} spellcheck="false"
          placeholder="เช่น repairTime / failures" oninput={() => (app.kpiError = '')} />
        {#if err}
          <span class="err">{err}</span>
        {:else}
          <span class="ok">ตัวอย่าง (ค่าทดสอบ) = <b>{fmtNum(evalFormula(f.formula, SAMPLE_VALUES))}</b></span>
        {/if}
      </label>
      {#if editable}
        <div class="vars">
          <span class="lbl">ตัวแปร (กดเพื่อใส่ในสูตร)</span>
          {#each METRIC_VARIABLES as v}
            <button title={v.label} onclick={() => insertVar(v.id)}><code>{v.id}</code><span>{v.label}</span></button>
          {/each}
          <span class="lbl">ใช้ + − * / และวงเล็บ ( ) ได้</span>
        </div>
      {/if}
      <div class="row2">
        <label>
          หน่วย
          <select bind:value={app.kpiForm.unit} disabled={!editable}>
            {#each units as u}
              <option value={u.value}>{u.label}</option>
            {/each}
          </select>
        </label>
        <label>
          เป้าหมาย
          <input bind:value={app.kpiForm.targetText} inputmode="decimal" placeholder="ไม่ตั้งเป้า" disabled={!editable}
            oninput={() => (app.kpiError = '')} />
        </label>
      </div>
      <div class="better" role="group" aria-label="ทิศทางที่ดี">
        <span class="lbl">ทิศทางที่ดี</span>
        <div class="seg">
          <button class:on={f.better === 'lower'} disabled={!editable} onclick={() => (f.better = 'lower')}>▼ {BETTER_LABEL.lower}</button>
          <button class:on={f.better === 'higher'} disabled={!editable} onclick={() => (f.better = 'higher')}>▲ {BETTER_LABEL.higher}</button>
        </div>
      </div>
      {#if editable}
        <div class="foot">
          {#if app.kpiError}<p class="error">{app.kpiError}</p>{/if}
          {#if f.id}
            <button class="danger" onclick={() => guarded.deleteKpi(f.id!)}>ลบ KPI</button>
          {/if}
          <button class="ghostbtn" onclick={() => guarded.closeKpiForm()}>ยกเลิก</button>
          <button class="primary" disabled={!!f.id && !dirty} onclick={() => actions.saveKpiForm()}>บันทึก</button>
        </div>
        {#if f.id && dirty}<p class="unsaved">● มีการแก้ไขที่ยังไม่บันทึก</p>{/if}
      {/if}
    </div>
  {/if}
{/snippet}

<aside class="kpipanel">
  <header>
    <h3>KPIs</h3>
    {#if editable && !(app.kpiForm && !app.kpiForm.id)}
      <button class="primary" onclick={async () => (await guarded.closeKpiForm()) && actions.startKpiDraft()}>+ สร้าง KPI</button>
    {/if}
  </header>

  <div class="filters">
    <select bind:value={app.kpiScope} title="ขอบเขต">
      <option value="site">ทั้งโรงงาน</option>
      {#each app.site.lines.filter((l) => l.id !== app.draftLineId) as l (l.id)}
        <option value={l.id}>{l.name}</option>
      {/each}
    </select>
    <div class="periods" role="group" aria-label="ช่วงเวลา">
      {#each PERIODS as p}
        <button class:on={app.kpiPeriod === p.id} onclick={() => (app.kpiPeriod = p.id)}>{p.label}</button>
      {/each}
    </div>
  </div>
  <p class="meta">{scopeName} · นับจากเครื่องที่เปิด Andon <b>{result.machines}</b> เครื่อง</p>

  <div class="scroll">
    {#if app.kpiForm && !app.kpiForm.id}
      <section class="card open isnew">
        <div class="newtag">KPI ใหม่ · ยังไม่บันทึก</div>
        {@render editor()}
      </section>
    {/if}

    {#each result.items as it (it.kpi.id)}
      {@const open = app.kpiForm?.id === it.kpi.id}
      <section class="card {it.state}" class:open>
        <button class="sum" onclick={() => guarded.openKpi(it.kpi.id)} title="กดเพื่อตั้งค่า">
          <span class="name">{it.kpi.name}</span>
          <span class="val">{fmtNum(it.value)} <small>{it.kpi.unit}</small></span>
          {#if it.kpi.target !== null}
            <span class="target">เป้า {it.kpi.better === 'lower' ? '≤' : '≥'} {fmtNum(it.kpi.target)} {it.kpi.unit}
              {#if it.state === 'good'}· ผ่าน{:else if it.state === 'bad'}· ไม่ผ่าน{/if}</span>
          {:else}
            <span class="target">ไม่ได้ตั้งเป้า</span>
          {/if}
        </button>
        {#if open}{@render editor()}{/if}
      </section>
    {:else}
      {#if !app.kpiForm}<p class="empty">ยังไม่มี KPI {#if editable}กด <b>+ สร้าง KPI</b>{/if}</p>{/if}
    {/each}

    <section class="settings">
      <h4>นับเป็น "เสีย" (ตัวแปร failures)</h4>
      {#each app.site.andonStates as st (st.id)}
        <label class="chk">
          <input type="checkbox" checked={app.site.metrics.failureStates.includes(st.id)} disabled={!editable}
            onchange={() => actions.toggleFailureState(st.id)} />
          <span class="dot" style="background:{st.color}"></span>{st.name}
        </label>
      {/each}
      {#if editable}
        <button class="reset" onclick={() => guarded.resetKpis()}>คืน KPI เริ่มต้น (MTTR / MTBF)</button>
      {/if}
    </section>

    <p class="note">ตอนนี้ค่าที่แสดงมาจาก<b>ข้อมูลตัวอย่าง</b> เพื่อทดลองสูตรและหน้าจอ ค่าจริงจะคำนวณจากประวัติการแจ้ง Andon เมื่อเชื่อมระบบบันทึกเหตุการณ์ (backend)</p>
  </div>
</aside>

<style>
  .kpipanel {
    position: absolute; top: 16px; left: 16px; bottom: 16px; width: 340px; z-index: 3;
    display: flex; flex-direction: column; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06); font-family: system-ui, sans-serif; overflow: hidden;
  }
  header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 8px; }
  h3 { margin: 0; font-size: 14px; color: #0f172a; }
  .filters { display: flex; gap: 6px; padding: 0 14px; }
  .filters select { flex: 1; min-width: 0; font: 13px system-ui, sans-serif; padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 7px; background: #fff; }
  .periods { display: flex; background: #f1f5f9; border-radius: 7px; padding: 2px; }
  .periods button { border: 0; background: transparent; padding: 4px 8px; border-radius: 5px; font: 12px system-ui, sans-serif; color: #475569; cursor: pointer; white-space: nowrap; }
  .periods button.on { background: #fff; color: #0f172a; font-weight: 600; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12); }
  .meta { margin: 6px 14px 8px; font-size: 11.5px; color: #64748b; }
  .meta b { color: #0f172a; }
  .scroll { overflow-y: auto; padding: 0 12px 12px; display: flex; flex-direction: column; gap: 8px; border-top: 1px solid #f1f5f9; padding-top: 10px; }

  .card { border: 1px solid #e5e7eb; border-left: 4px solid #cbd5e1; border-radius: 10px; background: #fff; }
  .card.good { border-left-color: #16a34a; }
  .card.bad { border-left-color: #dc2626; }
  .card.open { box-shadow: 0 0 0 2px #bfdbfe; border-color: #93c5fd; }
  .card.isnew { border-style: dashed; border-left-style: solid; border-left-color: #2563eb; }
  .newtag { margin: 8px 10px 0; display: inline-block; font-size: 10.5px; font-weight: 600; color: #b45309; background: #fef3c7; border-radius: 999px; padding: 1px 8px; }
  .sum { width: 100%; display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; align-items: baseline; padding: 10px 12px; border: 0; background: transparent; cursor: pointer; text-align: left; font-family: system-ui, sans-serif; }
  .name { font-size: 13px; font-weight: 600; color: #334155; }
  .val { font-size: 20px; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; text-align: right; }
  .val small { font-size: 12px; font-weight: 500; color: #64748b; }
  .target { grid-column: 1 / -1; font-size: 11.5px; color: #94a3b8; }
  .good .target { color: #16a34a; }
  .bad .target { color: #dc2626; }

  .editor { display: flex; flex-direction: column; gap: 8px; padding: 4px 12px 12px; border-top: 1px solid #f1f5f9; }
  .isnew .editor { border-top: 0; padding-top: 8px; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; color: #64748b; }
  input:not([type='checkbox']) { font: 13px system-ui, sans-serif; padding: 7px 9px; border: 1px solid #e2e8f0; border-radius: 7px; min-width: 0; color: #0f172a; }
  input:focus { outline: none; border-color: #93c5fd; box-shadow: 0 0 0 2px #dbeafe; }
  input:disabled { background: #f8fafc; color: #475569; }
  .mono { font-family: ui-monospace, monospace !important; }
  .bad.mono, input.bad { border-color: #fca5a5; }
  .err { font-size: 11.5px; color: #dc2626; }
  .ok { font-size: 11.5px; color: #64748b; }
  .ok b { color: #16a34a; }
  .vars { display: flex; flex-direction: column; gap: 2px; }
  .vars .lbl { font-size: 11px; color: #94a3b8; margin: 2px 0; }
  .vars button { display: flex; align-items: baseline; gap: 8px; text-align: left; border: 1px solid transparent; background: #f8fafc; border-radius: 6px; padding: 4px 8px; cursor: pointer; }
  .vars button:hover { border-color: #bfdbfe; background: #eff6ff; }
  .vars code { font-size: 12px; color: #1d4ed8; }
  .vars span { font-size: 11.5px; color: #64748b; }
  .row2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
  .row2 label { min-width: 0; }
  .row2 input, .row2 select { width: 100%; box-sizing: border-box; }
  select { font: 13px system-ui, sans-serif; padding: 7px 6px; border: 1px solid #e2e8f0; border-radius: 7px; background: #fff; color: #0f172a; }
  .better { display: flex; flex-direction: column; gap: 4px; }
  .better .lbl { font-size: 11.5px; color: #64748b; }
  .seg { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .better button { border: 1px solid #e2e8f0; background: #fff; border-radius: 6px; padding: 6px; font: 12px system-ui, sans-serif; color: #334155; cursor: pointer; }
  .better button.on { border-color: #2563eb; background: #eff6ff; color: #1d4ed8; font-weight: 600; }
  .better button:disabled:not(.on) { opacity: 0.5; cursor: default; }
  .foot { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 6px; padding-top: 8px; border-top: 1px solid #f1f5f9; }
  .error { flex-basis: 100%; margin: 0; font-size: 12px; color: #dc2626; }
  .primary { border: 0; background: #2563eb; color: #fff; border-radius: 7px; padding: 7px 12px; font: 600 12px system-ui, sans-serif; cursor: pointer; }
  .primary:hover:not(:disabled) { background: #1d4ed8; }
  .primary:disabled { opacity: 0.4; cursor: default; }
  .unsaved { margin: 0; font-size: 11.5px; color: #b45309; text-align: right; }
  .ghostbtn { border: 1px solid #e2e8f0; background: #fff; color: #334155; border-radius: 7px; padding: 7px 12px; font: 12px system-ui, sans-serif; cursor: pointer; }
  .danger { margin-right: auto; border: 1px solid #fecaca; background: #fff; color: #dc2626; border-radius: 7px; padding: 7px 12px; font: 12px system-ui, sans-serif; cursor: pointer; }
  .danger:hover { background: #fef2f2; }

  .empty { margin: 16px; text-align: center; font-size: 13px; color: #64748b; }
  .settings { margin-top: 6px; padding-top: 10px; border-top: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 4px; }
  h4 { margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #334155; }
  .chk { flex-direction: row; align-items: center; gap: 6px; font-size: 12.5px; color: #1e293b; }
  .dot { width: 10px; height: 10px; border-radius: 50%; }
  .reset { align-self: flex-start; margin-top: 6px; border: 1px solid #e2e8f0; background: #fff; border-radius: 7px; padding: 6px 10px; font: 12px system-ui, sans-serif; color: #64748b; cursor: pointer; }
  .note { margin: 4px 2px 0; font-size: 11px; line-height: 1.6; color: #94a3b8; }
</style>
