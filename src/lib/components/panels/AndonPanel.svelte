<script lang="ts">
  // แผงตั้งค่า Andon: สีและความหมายของแต่ละสถานะ + สูตร MTTR / MTBF
  import { METRIC_VARIABLES, SAMPLE_VALUES, checkFormula, evalFormula } from '../../domain/formula';
  import { app, actions } from '../../stores/site.svelte';

  let editable = $derived(app.mode === 'edit');
  const metrics = $derived(app.site.metrics);

  const fmt = (v: number) => (Number.isFinite(v) ? v.toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '—');

  const FORMULAS = [
    { key: 'mttr', label: 'MTTR', desc: 'เวลาเฉลี่ยในการซ่อม (นาที)' },
    { key: 'mtbf', label: 'MTBF', desc: 'เวลาเฉลี่ยระหว่างการเสีย (นาที)' }
  ] as const;

  // ช่องสูตรที่โฟกัสล่าสุด (กดชิปตัวแปรแล้วแทรกที่ช่องนี้)
  let lastField = $state<'mttr' | 'mtbf'>('mttr');

  function insertVar(id: string) {
    actions.beginEdit();
    const cur = app.site.metrics[lastField].trim();
    app.site.metrics[lastField] = cur ? `${cur} ${id}` : id;
    actions.commitEdit();
  }

  let usedBy = $derived(
    Object.fromEntries(app.site.andonStates.map((s) => [s.id, app.site.assets.filter((a) => a.andon && a.status === s.id).length]))
  );
</script>

<aside class="panel">
  <header><h3>ตั้งค่า Andon</h3></header>

  <div class="scroll">
    <section>
      <h4>สถานะและสี</h4>
      <p class="hint">ตั้งชื่อและสีได้ตามมาตรฐานของโรงงาน · <b>ระดับ</b> ยิ่งสูงยิ่งร้ายแรง ใช้ตัดสินสีรวมของไลน์แบบ ByLine</p>

      <div class="states">
        <div class="row th"><span>สี</span><span>ความหมาย</span><span>ระดับ</span><span></span></div>
        {#each app.site.andonStates as st (st.id)}
          <div class="row">
            <input class="swatch" type="color" bind:value={st.color} disabled={!editable}
              onfocus={() => actions.beginEdit()} onchange={() => actions.commitEdit()} />
            <input class="txt" bind:value={st.name} disabled={!editable}
              onfocus={() => actions.beginEdit()} onchange={() => actions.commitEdit()} />
            <input class="num" type="number" step="1" bind:value={st.severity} disabled={!editable}
              onfocus={() => actions.beginEdit()} onchange={() => actions.commitEdit()} />
            {#if editable}
              <button class="icon" title={usedBy[st.id] ? `ลบ (เครื่อง ${usedBy[st.id]} ตัวจะกลับเป็นสถานะปกติ)` : 'ลบ'}
                disabled={app.site.andonStates.length <= 1} onclick={() => actions.deleteAndonState(st.id)}>×</button>
            {:else}<span></span>{/if}
          </div>
        {/each}
      </div>

      {#if editable}
        <div class="btns">
          <button onclick={() => actions.addAndonState()}>+ เพิ่มสถานะ</button>
          <button class="ghost" onclick={() => actions.resetAndonStates()}>คืนค่าเริ่มต้น</button>
        </div>
      {/if}
    </section>

    <section>
      <h4>ตัวชี้วัด MTTR / MTBF</h4>
      <p class="hint">แก้สูตรได้เอง ใช้ตัวแปรด้านล่าง กับ + − × ÷ และวงเล็บ (ใช้ * แทนคูณ, / แทนหาร)</p>

      {#each FORMULAS as f}
        {@const err = checkFormula(metrics[f.key])}
        <label class="formula">
          <span class="fl"><b>{f.label}</b> {f.desc}</span>
          <input bind:value={app.site.metrics[f.key]} disabled={!editable} class:bad={err} spellcheck="false"
            onfocus={() => { lastField = f.key; actions.beginEdit(); }} onchange={() => actions.commitEdit()} />
          {#if err}
            <span class="err">{err}</span>
          {:else}
            <span class="ok">ตัวอย่างผลลัพธ์ = <b>{fmt(evalFormula(metrics[f.key], SAMPLE_VALUES))}</b></span>
          {/if}
        </label>
      {/each}

      <div class="vars">
        {#each METRIC_VARIABLES as v}
          <button disabled={!editable} title="{v.label} (ค่าตัวอย่าง {v.sample})" onclick={() => insertVar(v.id)}>
            <code>{v.id}</code><span>{v.label}</span>
          </button>
        {/each}
      </div>

      <h4>นับเป็น "เสีย" (ใช้นับ failures)</h4>
      <div class="checks">
        {#each app.site.andonStates as st (st.id)}
          <label>
            <input type="checkbox" checked={metrics.failureStates.includes(st.id)} disabled={!editable}
              onchange={() => actions.toggleFailureState(st.id)} />
            <span class="dot" style="background:{st.color}"></span>{st.name}
          </label>
        {/each}
      </div>

      {#if editable}
        <div class="btns"><button class="ghost" onclick={() => actions.resetFormulas()}>คืนสูตรมาตรฐาน</button></div>
      {/if}
      <p class="note">ค่าจริงจะคำนวณจากประวัติ Andon เมื่อเชื่อมระบบบันทึกเหตุการณ์ (backend) ตอนนี้แสดงผลจากค่าตัวอย่าง</p>
    </section>
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
