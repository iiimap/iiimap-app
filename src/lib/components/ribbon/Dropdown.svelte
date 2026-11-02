<script lang="ts">
  import type { Snippet } from 'svelte';
  // กล่องดรอปดาวน์ใต้ปุ่มบน Ribbon (ปิดเมื่อคลิกที่อื่น หรือกด Esc)
  let {
    anchor,
    width = 260,
    onclose,
    children
  }: { anchor: DOMRect; width?: number; onclose: () => void; children: Snippet } = $props();

  let left = $derived(Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8)));
</script>

<svelte:window
  onkeydown={(e) => e.code === 'Escape' && onclose()}
  onpointerdown={(e) => !(e.target as HTMLElement).closest('.dd-panel, .dd-trigger, .backdrop') && onclose()}
/>

<div class="dd-panel" style="left:{left}px; top:{anchor.bottom + 4}px; width:{width}px">
  {@render children()}
</div>

<style>
  .dd-panel {
    position: fixed; z-index: 50; max-height: min(440px, calc(100vh - 200px)); overflow-y: auto;
    display: flex; flex-direction: column; padding: 6px;
    background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px;
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16); font-family: system-ui, sans-serif;
  }
</style>
