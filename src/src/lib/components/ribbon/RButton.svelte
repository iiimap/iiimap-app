<script lang="ts">
  import Icon from './Icon.svelte';
  // ปุ่มใน Ribbon: large = ไอคอนใหญ่ + ชื่อด้านล่าง / small = ไอคอนเล็ก + ชื่อด้านข้าง
  let {
    icon,
    label,
    title = '',
    size = 'small',
    disabled = false,
    active = false,
    onclick
  }: {
    icon: string;
    label: string;
    title?: string;
    size?: 'large' | 'small';
    disabled?: boolean;
    active?: boolean;
    onclick?: () => void;
  } = $props();
</script>

<button class={size} class:active {disabled} title={title || label} {onclick}>
  <Icon name={icon} size={size === 'large' ? 26 : 16} />
  <span>{label}</span>
</button>

<style>
  button {
    border: 1px solid transparent; background: transparent; border-radius: 6px;
    color: #1e293b; cursor: pointer; font: 12px system-ui, sans-serif;
  }
  button:hover:not(:disabled) { background: #eef2f7; border-color: #e2e8f0; }
  button.active { background: #dbeafe; border-color: #bfdbfe; color: #1d4ed8; }
  button:disabled { opacity: 0.35; cursor: default; }
  .large {
    display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
    gap: 4px; min-width: 52px; height: 64px; padding: 6px 6px 4px;
  }
  .large span { line-height: 1.2; text-align: center; }
  .small {
    display: flex; align-items: center; gap: 6px; height: 22px; padding: 0 8px 0 5px; white-space: nowrap;
  }
</style>
