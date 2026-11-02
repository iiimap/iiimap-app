<script lang="ts">
  import type { Snippet } from 'svelte';
  // กลุ่มใน Ribbon: เนื้อหาด้านบน ชื่อกลุ่มด้านล่าง เส้นคั่นด้านขวา
  let { label, children }: { label: string; children: Snippet } = $props();
</script>

<div class="group">
  <div class="body">{@render children()}</div>
  <div class="label">{label}</div>
</div>

<style>
  .group {
    display: flex; flex-direction: column; padding: 4px 8px 2px;
    border-right: 1px solid #e5e7eb; flex: none;
  }
  .body { flex: 1; display: flex; align-items: flex-start; gap: 2px; }
  .label { font: 11px system-ui, sans-serif; color: #64748b; text-align: center; padding-top: 2px; }
</style>
