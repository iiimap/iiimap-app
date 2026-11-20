<script lang="ts">
  // ศูนย์ตั้งค่า › 5ส / ถังดับเพลิง
  // รอบตรวจ (ปุ่มลัด) · เตือนล่วงหน้า (แถบเลื่อน + ไทม์ไลน์สี) · เกณฑ์ผ่าน (5ส) · รายการหัวข้อ (ลากเรียง, แม่แบบ)
  import type { AuditModule } from '../../domain/types';
  import { type SettingsDraft } from '../../stores/site.svelte';
  import { ask } from '../../stores/confirm.svelte';
  import { AUDIT_TEMPLATES, DEFAULT_AUDIT_CONFIG, INTERVAL_PRESETS } from '../../domain/defaults';
  import { AUDIT_STATUS_COLOR, fiveSColor } from '../../domain/audit';

  let { module, draft = $bindable() }: { module: AuditModule; draft: SettingsDraft } = $props();

  let cfg = $derived(draft.audit[module]);
  let items = $derived(module === 'fire' ? draft.audit.fire.checklist : draft.audit.fiveS.categories);
  const setItems = (list: string[]) => {
    if (module === 'fire') draft.audit.fire.checklist = list;
    else draft.audit.fiveS.categories = list;
  };

  // ---------- รอบตรวจ ----------
  let customOpen = $state(false);
  let isPreset = $derived(INTERVAL_PRESETS.some((p) => p.days === cfg.intervalDays));
  let showCustom = $derived(customOpen || !isPreset);
  function setEvery(days: number) {
    const d = Math.max(1, Math.min(3650, Math.round(days) || 1));
    draft.audit[module].intervalDays = d;
    if (cfg.dueSoonDays > d - 1) draft.audit[module].dueSoonDays = Math.max(0, d - 1);
  }

  // ---------- เตือนล่วงหน้า + ไทม์ไลน์ ----------
  let soonMax = $derived(Math.max(0, Math.min(60, cfg.intervalDays - 1)));
  const dateIn = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  };
  let okPct = $derived(((cfg.intervalDays - cfg.dueSoonDays) / cfg.intervalDays) * 82);
  let soonPct = $derived((cfg.dueSoonDays / cfg.intervalDays) * 82);
  let thing = $derived(module === 'fire' ? 'ถัง' : 'ไลน์');

  // ---------- เกณฑ์ผ่าน (5ส) ----------
  let pass = $derived(draft.audit.fiveS.passScore);
  let good = $derived(Math.max(80, pass));
  let maxPoints = $derived(draft.audit.fiveS.categories.length * 5);
  let needPoints = $derived(Math.ceil((pass / 100) * maxPoints - 1e-9));

  // ---------- รายการหัวข้อ ----------
  let newItem = $state('');
  let dupes = $derived(items.map((x, i) => !x.trim() || items.findIndex((y) => y.trim() === x.trim()) !== i));

  function addItem() {
    const t = newItem.trim();
    if (!t) return;
    if (items.some((x) => x.trim() === t)) return;
    setItems([...items, t]);
    newItem = '';
  }

  async function removeItem(i: number) {
    if (items.length <= 1) return;
    const name = items[i].trim() || '(ไม่มีชื่อ)';
    if (!(await ask({ title: `ลบหัวข้อ "${name}"?`, message: 'มีผลหลังกดบันทึก · บันทึกการตรวจเก่ายังเก็บผลของหัวข้อนี้ไว้' }))) return;
    setItems(items.filter((_, j) => j !== i));
  }

  // ลากเรียง: กดค้างที่จุดจับ (⋮⋮) แล้วลาก
  let armed = $state(-1);
  let dragFrom = $state(-1);
  let dragOver = $state(-1);
  function drop(to: number) {
    if (dragFrom < 0 || dragFrom === to) return reset();
    const list = [...items];
    const [x] = list.splice(dragFrom, 1);
    list.splice(to, 0, x);
    setItems(list);
    reset();
  }
  function reset() {
    armed = dragFrom = dragOver = -1;
  }

  // แม่แบบ
  let tplOpen = $state(false);
  let tplBox = $state<HTMLElement>();
  async function useTemplate(t: { name: string; items: string[] }) {
    tplOpen = false;
    if (!(await ask({ title: `ใช้แม่แบบ "${t.name}"?`, message: `รายการหัวข้อปัจจุบัน ${items.length} ข้อ จะถูกแทนที่ด้วย ${t.items.length} ข้อจากแม่แบบ`, confirmText: 'ใช้แม่แบบ', danger: false })))
      return;
    setItems([...t.items]);
  }
  async function resetDefault() {
    if (!(await ask({ title: 'คืนค่าเริ่มต้น?', message: 'รอบตรวจ วันเตือนล่วงหน้า และรายการหัวข้อของหน้านี้จะกลับเป็นค่าเริ่มต้น (มีผลหลังกดบันทึก)', confirmText: 'คืนค่า' })))
      return;
    if (module === 'fire') draft.audit.fire = structuredClone(DEFAULT_AUDIT_CONFIG.fire);
    else draft.audit.fiveS = structuredClone(DEFAULT_AUDIT_CONFIG.fiveS);
    customOpen = false;
  }
</script>

<svelte:window onpointerdown={(e) => tplOpen && !tplBox?.contains(e.target as Node) && (tplOpen = false)} />

<div class="head">
  <div>
    <h2>{module === 'fire' ? 'ถังดับเพลิง' : '5ส'}</h2>
    <p class="sub">{module === 'fire' ? 'รอบการตรวจและเช็กลิสต์ของถังดับเพลิงทุกถัง' : 'รอบการตรวจ เกณฑ์ผ่าน และหัวข้อที่ให้คะแนน (ตรวจรายไลน์)'}</p>
  </div>
  <button class="link" onclick={resetDefault}>คืนค่าเริ่มต้น</button>
</div>

<!-- 1. รอบตรวจ -->
<section class="card">
  <h3><span class="n">1</span>ตรวจบ่อยแค่ไหน</h3>
  <div class="chips">
    {#each INTERVAL_PRESETS as p}
      <button class="chip" class:on={cfg.intervalDays === p.days && !customOpen} onclick={() => { customOpen = false; setEvery(p.days); }}>{p.label}</button>
    {/each}
    <button class="chip" class:on={showCustom} onclick={() => (customOpen = true)}>กำหนดเอง</button>
  </div>
  {#if showCustom}
    <div class="custom">
      ทุก
      <input type="number" min="1" max="3650" value={cfg.intervalDays} onchange={(e) => { setEvery(+e.currentTarget.value); e.currentTarget.value = String(cfg.intervalDays); }} />
      วัน
    </div>
  {/if}
</section>

<!-- 2. เตือนล่วงหน้า -->
<section class="card">
  <h3><span class="n">2</span>เตือนล่วงหน้า <b class="val">{cfg.dueSoonDays} วัน</b></h3>
  <input class="range" type="range" min="0" max={soonMax} step="1" bind:value={draft.audit[module].dueSoonDays} disabled={soonMax === 0} />
  <div class="bar">
    <span style="flex-basis:{okPct}%;background:{AUDIT_STATUS_COLOR.ok}"></span>
    <span style="flex-basis:{soonPct}%;background:{AUDIT_STATUS_COLOR.soon}"></span>
    <span style="flex-basis:18%;background:{AUDIT_STATUS_COLOR.overdue}"></span>
  </div>
  <div class="ticks" style="--ok:{okPct}%;--due:{okPct + soonPct}%">
    <span class="t0">ตรวจวันนี้</span>
    {#if cfg.dueSoonDays > 0}<span class="t1">เริ่มเตือน {dateIn(cfg.intervalDays - cfg.dueSoonDays)}</span>{/if}
    <span class="t2">ครบกำหนด {dateIn(cfg.intervalDays)}</span>
  </div>
  <p class="explain">
    ถ้าตรวจวันนี้ {thing}จะเป็น<b style="color:{AUDIT_STATUS_COLOR.ok}">สีเขียว</b>ถึง {dateIn(cfg.intervalDays - cfg.dueSoonDays - 1)}
    {#if cfg.dueSoonDays > 0}แล้วเปลี่ยนเป็น<b style="color:#b45309">สีเหลือง</b>ตั้งแต่ {dateIn(cfg.intervalDays - cfg.dueSoonDays)}{/if}
    และเป็น<b style="color:{AUDIT_STATUS_COLOR.overdue}">สีแดง</b>ถ้ายังไม่ตรวจหลัง {dateIn(cfg.intervalDays)}
  </p>
</section>

<!-- 3. เกณฑ์ผ่าน (5ส) -->
{#if module === 'fiveS'}
  <section class="card">
    <h3><span class="n">3</span>เกณฑ์ผ่าน <b class="val" style="color:{fiveSColor(pass, pass)}">{pass}%</b></h3>
    <input class="range" type="range" min="0" max="100" step="5" bind:value={draft.audit.fiveS.passScore} />
    <div class="bar">
      <span style="flex-basis:{pass}%;background:#ef4444"></span>
      <span style="flex-basis:{good - pass}%;background:#f59e0b"></span>
      <span style="flex-basis:{100 - good}%;background:#22c55e"></span>
    </div>
    <div class="legend">
      <span><i style="background:#ef4444"></i>ไม่ผ่าน ต่ำกว่า {pass}%</span>
      {#if good > pass}<span><i style="background:#f59e0b"></i>ผ่าน {pass}% ขึ้นไป</span>{/if}
      <span><i style="background:#22c55e"></i>ดี {good}% ขึ้นไป</span>
    </div>
    <p class="explain">มี {draft.audit.fiveS.categories.length} หัวข้อ หัวข้อละ 0–5 คะแนน → ต้องได้อย่างน้อย <b>{needPoints} จาก {maxPoints} คะแนน</b> จึงผ่าน</p>
  </section>
{/if}

<!-- 4. รายการหัวข้อ -->
<section class="card">
  <div class="lhead">
    <h3><span class="n">{module === 'fiveS' ? 4 : 3}</span>{module === 'fire' ? 'เช็กลิสต์' : 'หัวข้อที่ให้คะแนน'} <small>{items.length} ข้อ</small></h3>
    <div class="tpl" bind:this={tplBox}>
      <button class="link" onclick={() => (tplOpen = !tplOpen)}>เลือกจากแม่แบบ ▾</button>
      {#if tplOpen}
        <div class="menu">
          {#each AUDIT_TEMPLATES[module] as t}
            <button onclick={() => useTemplate(t)}><b>{t.name}</b><small>{t.items.length} ข้อ</small></button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
  <ul class="items">
    {#each items as _, i (i)}
      <li
        class:over={dragOver === i && dragFrom !== i}
        class:dragging={dragFrom === i}
        draggable={armed === i}
        ondragstart={(e) => { dragFrom = i; e.dataTransfer?.setData('text/plain', String(i)); }}
        ondragover={(e) => { if (dragFrom >= 0) { e.preventDefault(); dragOver = i; } }}
        ondrop={(e) => { e.preventDefault(); drop(i); }}
        ondragend={reset}
      >
        <span class="grip" title="ลากเพื่อเรียงลำดับ" role="presentation" onpointerdown={() => (armed = i)} onpointerup={() => dragFrom < 0 && (armed = -1)}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" /></svg>
        </span>
        <input
          class:bad={dupes[i]}
          value={items[i]}
          oninput={(e) => setItems(items.map((x, j) => (j === i ? e.currentTarget.value : x)))}
        />
        <button class="del" title={items.length <= 1 ? 'ต้องมีอย่างน้อย 1 ข้อ' : 'ลบหัวข้อ'} aria-label="ลบหัวข้อ" disabled={items.length <= 1} onclick={() => removeItem(i)}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M6 6l12 12 M18 6L6 18" /></svg>
        </button>
      </li>
    {/each}
    <li class="add">
      <span class="plus">+</span>
      <input
        bind:value={newItem}
        placeholder="พิมพ์หัวข้อใหม่แล้วกด Enter"
        onkeydown={(e) => { if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); e.stopPropagation(); addItem(); } }}
      />
    </li>
  </ul>
  {#if dupes.some(Boolean)}<p class="err">มีหัวข้อที่ว่างหรือซ้ำกัน (กรอบแดง) ตอนบันทึกระบบจะตัดออกให้</p>{/if}
  {#if newItem.trim() && items.some((x) => x.trim() === newItem.trim())}<p class="err">มีหัวข้อนี้อยู่แล้ว</p>{/if}
  {#if module === 'fiveS'}<p class="hint">เปลี่ยนชื่อหัวข้อแล้ว คะแนนในบันทึกการตรวจเก่ายังผูกกับชื่อเดิม</p>{/if}
</section>

<style>
  .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding-right: 36px; }
  h2 { margin: 0; font-size: 19px; color: #0f172a; }
  .sub { margin: 4px 0 18px; font-size: 13px; color: #64748b; }
  .card { border: 1px solid #eef2f6; border-radius: 12px; padding: 16px 18px; margin-bottom: 14px; background: #fff; }
  h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; font-size: 14px; color: #0f172a; font-weight: 600; }
  h3 small { font-weight: 400; font-size: 12px; color: #94a3b8; }
  .n { width: 20px; height: 20px; border-radius: 50%; background: #eff6ff; color: #2563eb; font-size: 11.5px; display: grid; place-items: center; flex: none; }
  .val { margin-left: auto; font-size: 14px; color: #0f172a; font-variant-numeric: tabular-nums; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    padding: 7px 14px; border-radius: 999px; border: 1px solid #e2e8f0; background: #fff; color: #334155;
    font: 13px system-ui, sans-serif; cursor: pointer;
  }
  .chip:hover { border-color: #cbd5e1; background: #f8fafc; }
  .chip.on { border-color: #3b82f6; background: #eff6ff; color: #1d4ed8; font-weight: 600; }
  .custom { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 13px; color: #334155; }
  .custom input { width: 90px; }
  input {
    font: 13.5px system-ui, sans-serif; color: #0f172a; padding: 7px 10px; border: 1px solid #e2e8f0;
    border-radius: 8px; min-width: 0; box-sizing: border-box; background: #fff;
  }
  input:focus { outline: none; border-color: #93c5fd; box-shadow: 0 0 0 3px #dbeafe; }
  input.bad { border-color: #fca5a5; background: #fff7f7; }
  .range { width: 100%; padding: 0; border: 0; accent-color: #2563eb; box-shadow: none; }
  .bar { display: flex; height: 12px; border-radius: 6px; overflow: hidden; margin: 10px 0 6px; gap: 2px; }
  .bar span { flex-grow: 0; flex-shrink: 0; transition: flex-basis 0.15s; }
  .ticks { position: relative; height: 16px; font-size: 11.5px; color: #64748b; }
  .ticks span { position: absolute; top: 0; white-space: nowrap; }
  .t0 { left: 0; }
  .t1 { left: var(--ok); transform: translateX(-50%); color: #b45309; }
  .t2 { left: var(--due); transform: translateX(-50%); color: #b91c1c; }
  .explain { margin: 12px 0 0; padding: 10px 12px; border-radius: 8px; background: #f8fafc; font-size: 13px; color: #334155; line-height: 1.6; }
  .explain b { font-weight: 600; margin: 0 2px; }
  .legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: 12px; color: #64748b; }
  .legend span { display: flex; align-items: center; gap: 6px; }
  .legend i { width: 10px; height: 10px; border-radius: 50%; }
  .lhead { display: flex; align-items: center; justify-content: space-between; }
  .lhead h3 { margin-bottom: 10px; }
  .link { border: 0; background: transparent; color: #2563eb; font: 13px system-ui, sans-serif; cursor: pointer; padding: 4px 6px; border-radius: 6px; white-space: nowrap; }
  .link:hover { background: #eff6ff; }
  .tpl { position: relative; }
  .menu {
    position: absolute; right: 0; top: calc(100% + 4px); z-index: 5; min-width: 240px; padding: 6px;
    background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14);
  }
  .menu button {
    display: flex; justify-content: space-between; align-items: center; gap: 12px; width: 100%; border: 0; background: transparent;
    padding: 8px 10px; border-radius: 7px; cursor: pointer; font: 13px system-ui, sans-serif; text-align: left;
  }
  .menu button:hover { background: #f1f5f9; }
  .menu b { font-weight: 500; color: #0f172a; }
  .menu small { color: #94a3b8; }
  .items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .items li { display: grid; grid-template-columns: 22px minmax(0, 1fr) 30px; align-items: center; gap: 6px; border-radius: 8px; }
  .items li.over { box-shadow: 0 -2px 0 #3b82f6; }
  .items li.dragging { opacity: 0.4; }
  .grip { display: grid; place-items: center; height: 32px; color: #cbd5e1; cursor: grab; }
  .grip:hover { color: #64748b; }
  .grip svg { fill: currentColor; }
  .del { width: 30px; height: 30px; display: grid; place-items: center; border: 0; background: transparent; color: #94a3b8; border-radius: 7px; cursor: pointer; }
  .del svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
  .del:hover:not(:disabled) { background: #fef2f2; color: #dc2626; }
  .del:disabled { opacity: 0.3; cursor: default; }
  .add .plus { text-align: center; color: #94a3b8; font-size: 16px; }
  .add input { border-style: dashed; grid-column: 2 / 4; }
  .err { margin: 8px 0 0; font-size: 12px; color: #dc2626; }
  .hint { margin: 8px 0 0; font-size: 12px; color: #94a3b8; }
</style>
