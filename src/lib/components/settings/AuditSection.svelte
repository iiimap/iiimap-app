<script lang="ts">
  // ศูนย์ตั้งค่า › 5ส / ถังดับเพลิง
  // รอบตรวจ (ปุ่มลัด) · เตือนล่วงหน้า (แถบเลื่อน + ไทม์ไลน์สี) · เกณฑ์คะแนน (5ส) · รายการหัวข้อ (ลากเรียง, แม่แบบ)
  import type { AuditModule } from '../../domain/types';
  import { type SettingsDraft } from '../../stores/site.svelte';
  import { ask } from '../../stores/confirm.svelte';
  import { AUDIT_TEMPLATES, DEFAULT_AUDIT_CONFIG, INTERVAL_PRESETS } from '../../domain/defaults';
  import { AUDIT_STATUS_COLOR } from '../../domain/audit';
  import { tick } from 'svelte';

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

  // ---------- เกณฑ์คะแนน (5ส): 2 ตัวจับบนแถบ (ผ่าน / ดี) หรือพิมพ์ตัวเลขเอง ----------
  let pass = $derived(draft.audit.fiveS.passScore);
  let good = $derived(draft.audit.fiveS.goodScore);
  let maxPoints = $derived(draft.audit.fiveS.categories.filter((x) => x.trim()).length * 5);
  const need = (pct: number) => Math.ceil((pct / 100) * maxPoints - 1e-9);
  let scaleEl = $state<HTMLElement>();
  let grab = $state<'pass' | 'good' | null>(null);
  const clampPct = (v: number) => Math.max(0, Math.min(100, Math.round(v) || 0));
  function setPass(v: number) {
    draft.audit.fiveS.passScore = clampPct(v);
    if (draft.audit.fiveS.goodScore < draft.audit.fiveS.passScore) draft.audit.fiveS.goodScore = draft.audit.fiveS.passScore;
  }
  function setGood(v: number) {
    draft.audit.fiveS.goodScore = clampPct(v);
    if (draft.audit.fiveS.passScore > draft.audit.fiveS.goodScore) draft.audit.fiveS.passScore = draft.audit.fiveS.goodScore;
  }
  const pctAt = (x: number) => {
    const r = scaleEl!.getBoundingClientRect();
    return ((x - r.left) / r.width) * 100;
  };
  function scaleDown(e: PointerEvent) {
    // กดตรงไหนของแถบ = ตัวจับที่ใกล้ที่สุดย้ายมาที่นั่น แล้วลากต่อได้
    const v = pctAt(e.clientX);
    grab = Math.abs(v - pass) <= Math.abs(v - good) && !(pass === good && v > good) ? 'pass' : 'good';
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    scaleMove(e);
  }
  function scaleMove(e: PointerEvent) {
    if (!grab) return;
    const v = pctAt(e.clientX);
    if (grab === 'pass') setPass(Math.min(v, good));
    else setGood(Math.max(v, pass));
  }
  function handleKey(e: KeyboardEvent, which: 'pass' | 'good') {
    const step = e.shiftKey ? 10 : 1;
    const d = e.code === 'ArrowRight' || e.code === 'ArrowUp' ? step : e.code === 'ArrowLeft' || e.code === 'ArrowDown' ? -step : 0;
    if (!d) return;
    e.preventDefault();
    if (which === 'pass') setPass(Math.min(pass + d, good));
    else setGood(Math.max(good + d, pass));
  }

  // ---------- รายการหัวข้อ ----------
  let listEl = $state<HTMLElement>();
  let dupes = $derived(items.map((x, i) => !!x.trim() && items.findIndex((y) => y.trim() === x.trim()) !== i));

  // กด + = เพิ่มช่องว่างท้ายรายการแล้วพิมพ์ได้เลย (ช่องที่ว่างอยู่ตอนบันทึก จะไม่ถูกบันทึก)
  async function addItem() {
    const last = items.length - 1;
    if (last >= 0 && !items[last].trim()) return focusRow(last);
    setItems([...items, '']);
    await tick();
    focusRow(items.length - 1);
  }
  function focusRow(i: number) {
    listEl?.querySelectorAll<HTMLInputElement>('li.it input')[i]?.focus();
  }

  async function removeItem(i: number) {
    if (items.filter((x) => x.trim()).length <= 1 && items[i].trim()) return;
    // ช่องว่างที่ยังไม่ได้พิมพ์ ลบได้เลย ไม่มีข้อมูลให้เสีย
    if (items[i].trim() && !(await ask({ title: `ลบหัวข้อ "${items[i].trim()}"?`, message: 'มีผลหลังกดบันทึก · บันทึกการตรวจเก่ายังเก็บผลของหัวข้อนี้ไว้' }))) return;
    setItems(items.filter((_, j) => j !== i));
  }
  let canRemove = $derived(items.filter((x) => x.trim()).length > 1);

  // ลากเรียง: กดค้างที่จุดจับ (⋮⋮) แล้วลากขึ้นลง แถวอื่นเลื่อนหลบให้เห็นตำแหน่งที่จะวาง
  let drag = $state<{ from: number; to: number; startY: number; dy: number; h: number; top0: number } | null>(null);
  let settling = $state(false); // ปิดแอนิเมชันตอนวาง ไม่ให้แถวกระตุก
  function gripDown(e: PointerEvent, i: number) {
    if (e.button !== 0 || items.length < 2) return;
    e.preventDefault();
    const rows = [...listEl!.querySelectorAll<HTMLElement>('li.it')];
    const tops = rows.map((r) => r.getBoundingClientRect().top);
    const h = tops[1] - tops[0];
    drag = { from: i, to: i, startY: e.clientY, dy: 0, h, top0: tops[i] };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function gripMove(e: PointerEvent) {
    if (!drag) return;
    const n = items.length;
    const min = -drag.from * drag.h, max = (n - 1 - drag.from) * drag.h;
    drag.dy = Math.max(min, Math.min(max, e.clientY - drag.startY));
    drag.to = Math.max(0, Math.min(n - 1, drag.from + Math.round(drag.dy / drag.h)));
  }
  async function gripUp() {
    if (!drag) return;
    const { from, to } = drag;
    settling = true;
    if (from !== to) {
      const list = [...items];
      const [x] = list.splice(from, 1);
      list.splice(to, 0, x);
      setItems(list);
    }
    drag = null;
    await tick();
    requestAnimationFrame(() => (settling = false));
  }
  function offset(i: number): number {
    if (!drag) return 0;
    const { from, to, dy, h } = drag;
    if (i === from) return dy;
    if (from < to && i > from && i <= to) return -h;
    if (from > to && i >= to && i < from) return h;
    return 0;
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

<!-- 3. เกณฑ์คะแนน (5ส) -->
{#if module === 'fiveS'}
  <section class="card">
    <h3><span class="n">3</span>เกณฑ์คะแนน</h3>
    <div class="scale" bind:this={scaleEl} role="presentation"
      onpointerdown={scaleDown} onpointermove={scaleMove} onpointerup={() => (grab = null)} onpointercancel={() => (grab = null)}>
      <div class="track">
        <span style="width:{pass}%;background:#ef4444"></span>
        <span style="width:{good - pass}%;background:#f59e0b"></span>
        <span style="width:{100 - good}%;background:#22c55e"></span>
      </div>
      <button class="knob" class:active={grab === 'pass'} style="left:{pass}%" aria-label="เกณฑ์ผ่าน {pass}%" onkeydown={(e) => handleKey(e, 'pass')}><b>{pass}</b></button>
      <button class="knob" class:active={grab === 'good'} style="left:{good}%" aria-label="เกณฑ์ดี {good}%" onkeydown={(e) => handleKey(e, 'good')}><b>{good}</b></button>
    </div>
    <div class="scale-ticks"><span>0%</span><span>100%</span></div>

    <div class="levels">
      <div class="lv"><i style="background:#ef4444"></i><b>ไม่ผ่าน</b><span>ต่ำกว่า {pass}%</span></div>
      <div class="lv">
        <i style="background:#f59e0b"></i><b>ผ่าน</b>
        <span>ตั้งแต่ <input type="number" min="0" max="100" value={pass} onchange={(e) => { setPass(+e.currentTarget.value); e.currentTarget.value = String(draft.audit.fiveS.passScore); }} /> %</span>
        {#if maxPoints}<small>≥ {need(pass)}/{maxPoints} คะแนน</small>{/if}
      </div>
      <div class="lv">
        <i style="background:#22c55e"></i><b>ดี</b>
        <span>ตั้งแต่ <input type="number" min="0" max="100" value={good} onchange={(e) => { setGood(+e.currentTarget.value); e.currentTarget.value = String(draft.audit.fiveS.goodScore); }} /> %</span>
        {#if maxPoints}<small>≥ {need(good)}/{maxPoints} คะแนน</small>{/if}
      </div>
    </div>
    <p class="hint">ลากจุดบนแถบ หรือพิมพ์ตัวเลข · สีกรอบไลน์บนผังเป็นไปตามเกณฑ์นี้ · ผลการตรวจ "ผ่าน/ไม่ผ่าน" ใช้เกณฑ์ผ่าน</p>
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
  <ul class="items" class:settling bind:this={listEl}>
    {#each items as _, i (i)}
      <li class="it" class:dragging={drag?.from === i} style="transform:translateY({offset(i)}px)">
        <span class="grip" title="ลากเพื่อเรียงลำดับ" role="presentation"
          onpointerdown={(e) => gripDown(e, i)} onpointermove={gripMove} onpointerup={gripUp} onpointercancel={gripUp}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" /></svg>
        </span>
        <input
          class:bad={dupes[i]}
          value={items[i]}
          placeholder="พิมพ์หัวข้อ (ว่างไว้ = ไม่บันทึก)"
          oninput={(e) => setItems(items.map((x, j) => (j === i ? e.currentTarget.value : x)))}
        />
        <button class="del" title={!canRemove && items[i].trim() ? 'ต้องมีอย่างน้อย 1 ข้อ' : 'ลบหัวข้อ'} aria-label="ลบหัวข้อ"
          disabled={!canRemove && !!items[i].trim()} onclick={() => removeItem(i)}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M6 6l12 12 M18 6L6 18" /></svg>
        </button>
      </li>
    {/each}
  </ul>
  <button class="addbtn" title="เพิ่มหัวข้อ" aria-label="เพิ่มหัวข้อ" onclick={addItem}>
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 5v14 M5 12h14" /></svg>
  </button>
  {#if dupes.some(Boolean)}<p class="err">มีหัวข้อซ้ำกัน (กรอบแดง) ตอนบันทึกจะเก็บไว้แค่ข้อเดียว</p>{/if}
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
  .items li {
    display: grid; grid-template-columns: 22px minmax(0, 1fr) 30px; align-items: center; gap: 6px;
    border-radius: 8px; position: relative; transition: transform 0.16s ease; background: #fff;
  }
  .items.settling li { transition: none; }
  .items li.dragging { transition: none; z-index: 2; box-shadow: 0 8px 20px rgba(15, 23, 42, 0.16); }
  .items li.dragging .grip { cursor: grabbing; color: #2563eb; }
  .grip { display: grid; place-items: center; height: 32px; color: #cbd5e1; cursor: grab; touch-action: none; user-select: none; }
  .grip:hover { color: #64748b; }
  .grip svg { fill: currentColor; }
  .del { width: 30px; height: 30px; display: grid; place-items: center; border: 0; background: transparent; color: #94a3b8; border-radius: 7px; cursor: pointer; }
  .del svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
  .del:hover:not(:disabled) { background: #fef2f2; color: #dc2626; }
  .del:disabled { opacity: 0.3; cursor: default; }
  .addbtn {
    margin: 6px 0 0 28px; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 8px;
    border: 1px dashed #cbd5e1; background: #fff; color: #64748b; cursor: pointer;
  }
  .addbtn:hover { border-color: #3b82f6; color: #2563eb; background: #eff6ff; }
  .addbtn svg { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
  .scale { position: relative; height: 34px; margin: 18px 12px 0; cursor: pointer; touch-action: none; }
  .track { position: absolute; left: 0; right: 0; top: 13px; height: 8px; border-radius: 4px; overflow: hidden; display: flex; }
  .track span { height: 100%; }
  .knob {
    position: absolute; top: 3px; width: 28px; height: 28px; margin-left: -14px; border-radius: 50%;
    background: #fff; border: 2px solid #334155; display: grid; place-items: center; padding: 0; cursor: grab;
    box-shadow: 0 2px 6px rgba(15, 23, 42, 0.18); font: 600 11px system-ui, sans-serif; color: #0f172a;
  }
  .knob b { font-weight: 600; }
  .knob.active { cursor: grabbing; border-color: #2563eb; box-shadow: 0 0 0 4px #dbeafe; }
  .knob:focus-visible { outline: none; border-color: #2563eb; box-shadow: 0 0 0 4px #dbeafe; }
  .scale-ticks { display: flex; justify-content: space-between; margin: 2px 0 12px; font-size: 11px; color: #94a3b8; }
  .levels { display: flex; flex-direction: column; gap: 6px; }
  .lv { display: grid; grid-template-columns: 12px 64px auto 1fr; align-items: center; gap: 8px; font-size: 13px; color: #334155; min-height: 34px; }
  .lv i { width: 12px; height: 12px; border-radius: 50%; }
  .lv b { font-weight: 600; }
  .lv span { display: flex; align-items: center; gap: 6px; }
  .lv input { width: 72px; padding: 5px 8px; }
  .lv small { color: #94a3b8; font-size: 12px; }
  .err { margin: 8px 0 0; font-size: 12px; color: #dc2626; }
  .hint { margin: 8px 0 0; font-size: 12px; color: #94a3b8; }
</style>
