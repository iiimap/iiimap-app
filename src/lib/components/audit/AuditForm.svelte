<script lang="ts">
  // หน้าต่างบันทึกการตรวจ 1 ครั้ง
  // - ถังดับเพลิง: เช็กลิสต์ ผ่าน / ไม่ผ่าน ทีละข้อ (ผ่านทุกข้อ = ผ่าน)
  // - 5ส: ให้คะแนน 0–5 ทีละหัวข้อ (คะแนนรวม % ≥ เกณฑ์ = ผ่าน)
  import { app, actions } from '../../stores/site.svelte';
  import { ask } from '../../stores/confirm.svelte';
  import { fiveSPercent } from '../../domain/audit';

  let date = $state('');
  let inspector = $state('');
  let note = $state('');
  let checks = $state<Record<string, boolean>>({});
  let scores = $state<Record<string, number>>({});
  let dirty = $state(false);

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // เปิดหน้าต่าง = ตั้งค่าเริ่มต้นใหม่
  $effect(() => {
    const f = app.auditForm;
    if (!f) return;
    date = today();
    try {
      inspector = localStorage.getItem('iiimap.inspector') ?? '';
    } catch {
      inspector = '';
    }
    note = '';
    checks = Object.fromEntries(app.site.auditConfig.fire.checklist.map((c) => [c, true]));
    scores = {};
    dirty = false;
  });

  let module = $derived(app.auditForm?.module);
  let target = $derived(
    app.auditForm
      ? module === 'fire'
        ? app.site.assets.find((a) => a.id === app.auditForm!.targetId)?.name
        : app.site.lines.find((l) => l.id === app.auditForm!.targetId)?.name
      : ''
  );
  let categories = $derived(app.site.auditConfig.fiveS.categories);
  let checklist = $derived(app.site.auditConfig.fire.checklist);
  let percent = $derived(fiveSPercent(scores, categories));
  let allScored = $derived(categories.every((c) => scores[c] !== undefined));
  let passed = $derived(
    module === 'fire' ? checklist.every((c) => checks[c] !== false) : allScored && percent >= app.site.auditConfig.fiveS.passScore
  );
  let valid = $derived(!!inspector.trim() && !!date && (module === 'fire' || allScored));

  function save() {
    const f = app.auditForm;
    if (!f || !valid) return;
    // วันที่เลือกเป็นวันนี้ = ใช้เวลาตอนนี้ / วันอื่น = เที่ยงวันของวันนั้น
    const [y, m, d] = date.split('-').map(Number);
    const at = date === today() ? Date.now() : new Date(y, m - 1, d, 12).getTime();
    try {
      localStorage.setItem('iiimap.inspector', inspector.trim());
    } catch {
      /* ไม่จำก็ไม่เป็นไร */
    }
    actions.addAudit({
      module: f.module,
      targetId: f.targetId,
      at,
      inspector: inspector.trim(),
      checks: f.module === 'fire' ? { ...checks } : {},
      scores: f.module === 'fiveS' ? { ...scores } : {},
      passed,
      score: f.module === 'fiveS' ? percent : null,
      note: note.trim()
    });
    app.auditForm = null;
  }

  async function cancel() {
    if (dirty && !(await ask({ title: 'ยกเลิกการบันทึกการตรวจ?', message: 'ข้อมูลที่กรอกไว้จะหายไป', confirmText: 'ยกเลิก' }))) return;
    app.auditForm = null;
  }

  function onKey(e: KeyboardEvent) {
    if (app.auditForm && e.code === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      cancel();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if app.auditForm}
  <div class="backdrop" role="presentation" onpointerdown={(e) => e.target === e.currentTarget && cancel()}>
    <form class="modal" oninput={() => (dirty = true)} onsubmit={(e) => { e.preventDefault(); save(); }}>
      <h3>{module === 'fire' ? 'บันทึกการตรวจถังดับเพลิง' : 'บันทึกการตรวจ 5ส'} · <span>{target}</span></h3>

      <div class="row2">
        <label>วันที่ตรวจ<input type="date" bind:value={date} max={today()} /></label>
        <label>ผู้ตรวจ<input bind:value={inspector} placeholder="ชื่อผู้ตรวจ" /></label>
      </div>

      {#if module === 'fire'}
        <div class="list">
          {#each checklist as c}
            <div class="item" class:bad={checks[c] === false}>
              <span>{c}</span>
              <div class="pf">
                <button type="button" class="p" class:on={checks[c] !== false} onclick={() => { checks[c] = true; dirty = true; }}>✓ ผ่าน</button>
                <button type="button" class="f" class:on={checks[c] === false} onclick={() => { checks[c] = false; dirty = true; }}>✗ ไม่ผ่าน</button>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="list">
          {#each categories as c}
            <div class="item">
              <span>{c}</span>
              <div class="sc">
                {#each [0, 1, 2, 3, 4, 5] as n}
                  <button type="button" class:on={scores[c] === n} onclick={() => { scores[c] = n; dirty = true; }}>{n}</button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <label>หมายเหตุ<textarea bind:value={note} rows="2" placeholder="ไม่บังคับ"></textarea></label>

      <div class="result" class:ok={passed} class:ng={!passed && (module === 'fire' || allScored)}>
        {#if module === 'fire'}
          ผลการตรวจ: <b>{passed ? 'ผ่าน' : 'ไม่ผ่าน'}</b>
        {:else if allScored}
          คะแนนรวม <b>{percent}%</b> · เกณฑ์ผ่าน {app.site.auditConfig.fiveS.passScore}% · <b>{passed ? 'ผ่าน' : 'ไม่ผ่าน'}</b>
        {:else}
          ให้คะแนนให้ครบทุกหัวข้อ ({Object.keys(scores).filter((k) => categories.includes(k)).length}/{categories.length})
        {/if}
      </div>

      <div class="btns">
        <button type="button" class="cancel" onclick={cancel}>ยกเลิก</button>
        <button type="submit" class="ok" disabled={!valid}>บันทึก</button>
      </div>
    </form>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; background: rgba(15, 23, 42, 0.32); font-family: system-ui, sans-serif; }
  .modal {
    width: min(520px, calc(100vw - 32px)); max-height: calc(100vh - 48px); overflow-y: auto; box-sizing: border-box; padding: 20px;
    border-radius: 12px; background: #fff; box-shadow: 0 20px 48px rgba(15, 23, 42, 0.25); display: flex; flex-direction: column; gap: 12px;
  }
  h3 { margin: 0; font-size: 16px; color: #0f172a; }
  h3 span { color: #2563eb; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #64748b; min-width: 0; }
  input, textarea {
    font: 14px system-ui, sans-serif; color: #0f172a; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 8px;
    width: 100%; box-sizing: border-box; resize: vertical;
  }
  input:focus, textarea:focus { outline: none; border-color: #93c5fd; box-shadow: 0 0 0 2px #dbeafe; }
  .row2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
  .list { display: flex; flex-direction: column; gap: 6px; }
  .item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 8px; }
  .item.bad { border-color: #fecaca; background: #fef2f2; }
  .item > span { font-size: 13.5px; color: #0f172a; }
  .pf { display: flex; gap: 4px; flex: none; }
  .pf button, .sc button {
    border: 1px solid #e2e8f0; background: #fff; color: #64748b; border-radius: 7px; cursor: pointer; font: 600 12.5px system-ui, sans-serif;
  }
  .pf button { padding: 5px 10px; }
  .pf .p.on { border-color: #86efac; background: #f0fdf4; color: #15803d; }
  .pf .f.on { border-color: #fca5a5; background: #fee2e2; color: #b91c1c; }
  .sc { display: flex; gap: 3px; flex: none; }
  .sc button { width: 32px; height: 30px; padding: 0; }
  .sc button.on { border-color: #2563eb; background: #2563eb; color: #fff; }
  .result { padding: 10px 12px; border-radius: 8px; background: #f8fafc; font-size: 13.5px; color: #475569; }
  .result.ok { background: #f0fdf4; color: #15803d; }
  .result.ng { background: #fef2f2; color: #b91c1c; }
  .btns { display: flex; justify-content: flex-end; gap: 8px; }
  .btns button { border-radius: 8px; padding: 8px 16px; font: 600 13px system-ui, sans-serif; cursor: pointer; }
  .cancel { border: 1px solid #e2e8f0; background: #fff; color: #334155; }
  .ok { border: 0; background: #2563eb; color: #fff; }
  .ok:disabled { opacity: 0.4; cursor: default; }
</style>
