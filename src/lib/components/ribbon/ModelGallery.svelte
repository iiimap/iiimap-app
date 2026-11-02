<script lang="ts">
  // แกลเลอรีโมเดลแบบดรอปดาวน์ (เหมือนปุ่ม "รูปร่าง" ใน Word)
  // รองรับโมเดลจำนวนมาก: ค้นหาได้ เลื่อนดูได้ ชื่อแสดงเต็ม
  import { CATEGORIES, MODELS, type CategoryId } from '../../domain/catalog';
  import { app, actions } from '../../stores/site.svelte';

  let {
    category = null,
    thumbs,
    anchor,
    onclose
  }: {
    category?: CategoryId | null; // null = ทุกหมวด
    thumbs: Record<string, string>;
    anchor: DOMRect;
    onclose: () => void;
  } = $props();

  let query = $state('');
  let input: HTMLInputElement;

  let sections = $derived(
    CATEGORIES.filter((c) => !category || c.id === category)
      .map((c) => ({
        ...c,
        models: Object.values(MODELS).filter(
          (m) =>
            m.category === c.id &&
            (!query.trim() ||
              m.label.toLowerCase().includes(query.trim().toLowerCase()) ||
              m.prefix.toLowerCase().includes(query.trim().toLowerCase()))
        )
      }))
      .filter((c) => c.models.length > 0)
  );

  // วางชิดใต้ปุ่ม แต่ไม่ให้หลุดขอบขวาของจอ
  const WIDTH = 440;
  let left = $derived(Math.max(8, Math.min(anchor.left, window.innerWidth - WIDTH - 8)));

  function pick(id: string) {
    actions.startPlacing(id);
    onclose();
  }

  $effect(() => {
    input?.focus();
  });
</script>

<svelte:window
  onkeydown={(e) => e.code === 'Escape' && onclose()}
  onpointerdown={(e) => !(e.target as HTMLElement).closest('.gallery, .gallery-trigger') && onclose()}
/>

<div class="gallery" style="left:{left}px; top:{anchor.bottom + 4}px; width:{WIDTH}px">
  <input bind:this={input} bind:value={query} placeholder="ค้นหาโมเดล เช่น CNC, สายพาน" />
  <div class="scroll">
    {#each sections as sec}
      <h4>{sec.label}</h4>
      <div class="grid">
        {#each sec.models as m}
          <button class:on={app.placing === m.id} onclick={() => pick(m.id)}>
            {#if thumbs[m.id]}<img src={thumbs[m.id]} alt="" />{:else}<span class="ph"></span>{/if}
            <span class="name">{m.label}</span>
            <span class="size">{m.w} × {m.d} ม.</span>
          </button>
        {/each}
      </div>
    {:else}
      <p class="empty">ไม่พบโมเดลที่ค้นหา</p>
    {/each}
  </div>
</div>

<style>
  .gallery {
    position: fixed; z-index: 50; max-height: min(520px, calc(100vh - 200px));
    display: flex; flex-direction: column; padding: 10px;
    background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px;
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16); font-family: system-ui, sans-serif;
  }
  input {
    font: 13px system-ui, sans-serif; padding: 8px 10px; margin-bottom: 8px;
    border: 1px solid #e2e8f0; border-radius: 7px; outline: none;
  }
  input:focus { border-color: #93c5fd; box-shadow: 0 0 0 2px #dbeafe; }
  .scroll { overflow-y: auto; }
  h4 { margin: 8px 2px 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; color: #64748b; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
  button {
    display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 4px;
    border: 1px solid transparent; border-radius: 8px; background: transparent; cursor: pointer;
  }
  button:hover { background: #f1f5f9; border-color: #e2e8f0; }
  button.on { background: #dbeafe; border-color: #93c5fd; }
  img, .ph { width: 64px; height: 64px; display: block; }
  .ph { background: #eef2f6; border-radius: 6px; }
  .name { font-size: 12px; color: #0f172a; text-align: center; line-height: 1.3; }
  .size { font-size: 11px; color: #94a3b8; }
  .empty { margin: 16px; text-align: center; font-size: 13px; color: #94a3b8; }
</style>
