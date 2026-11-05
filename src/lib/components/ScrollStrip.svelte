<script lang="ts">
  import type { Snippet } from 'svelte';
  // แถวการ์ดที่เลื่อนซ้าย-ขวาด้วยลูกศร (ลูกศรขึ้นเฉพาะด้านที่ยังมีการ์ดซ่อนอยู่)
  let { title, children }: { title: string; children: Snippet } = $props();

  let strip = $state<HTMLDivElement>();
  let canLeft = $state(false);
  let canRight = $state(false);

  function update() {
    if (!strip) return;
    canLeft = strip.scrollLeft > 4;
    canRight = strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 4;
  }
  function go(dir: 1 | -1) {
    strip?.scrollBy({ left: dir * strip.clientWidth * 0.8, behavior: 'smooth' });
  }
  $effect(() => {
    if (!strip) return;
    const ro = new ResizeObserver(update);
    ro.observe(strip);
    const mo = new MutationObserver(update); // จำนวนการ์ดเปลี่ยน
    mo.observe(strip, { childList: true });
    update();
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  });
</script>

<div class="wrap">
  <span class="title">{title}</span>
  <div class="strip" bind:this={strip} onscroll={update}>{@render children()}</div>
  {#if canLeft}
    <button class="arrow left" aria-label="เลื่อนไปทางซ้าย" onclick={() => go(-1)}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
    </button>
  {/if}
  {#if canRight}
    <button class="arrow right" aria-label="เลื่อนไปทางขวา" onclick={() => go(1)}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
    </button>
  {/if}
</div>

<style>
  .wrap { position: relative; flex: 1 1 0; min-width: 0; height: 100%; display: flex; flex-direction: column; }
  .title { font: 600 11px system-ui, sans-serif; letter-spacing: 0.06em; color: #94a3b8; padding: 0 2px 4px; }
  .strip {
    flex: 1; display: flex; gap: 10px; align-items: stretch; overflow-x: auto; overflow-y: hidden; scrollbar-width: none;
  }
  .strip::-webkit-scrollbar { display: none; }
  .arrow {
    position: absolute; top: calc(50% + 8px); transform: translateY(-50%); z-index: 1; width: 36px; height: 36px; border-radius: 50%;
    display: grid; place-items: center; padding: 0; border: 1px solid #e2e8f0; background: #ffffff;
    color: #334155; cursor: pointer; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
  }
  .arrow:hover { background: #f1f5f9; color: #2563eb; }
  .arrow.left { left: -6px; }
  .arrow.right { right: -6px; }
</style>
