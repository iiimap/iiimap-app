<script lang="ts">
  import { app } from '../stores/site.svelte';
</script>

{#if app.toast}
  <div class="toast" role="status">{app.toast}</div>
{/if}

<style>
  .toast {
    position: absolute; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 6;
    padding: 9px 16px; border-radius: 8px; background: #1e293b; color: #fff;
    font: 13px system-ui, sans-serif; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.25); pointer-events: none;
  }
</style>
