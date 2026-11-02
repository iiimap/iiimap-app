<script lang="ts">
  import { dialog, answer } from '../stores/confirm.svelte';

  let okBtn = $state<HTMLButtonElement>();
  $effect(() => {
    if (dialog.open) okBtn?.focus();
  });

  function onKey(e: KeyboardEvent) {
    if (!dialog.open) return;
    // หยุดไม่ให้คีย์ลัดอื่นทำงานระหว่างถาม
    e.stopImmediatePropagation();
    if (e.code === 'Escape') {
      e.preventDefault();
      answer(false);
    } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      answer(true);
    }
  }
</script>

<svelte:window onkeydowncapture={onKey} />

{#if dialog.open}
  <div class="backdrop" role="presentation" onpointerdown={(e) => e.target === e.currentTarget && answer(false)}>
    <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="cm-title">
      <h3 id="cm-title">{dialog.title}</h3>
      {#if dialog.message}<p>{dialog.message}</p>{/if}
      <div class="btns">
        <button class="cancel" onclick={() => answer(false)}>ไม่ใช่</button>
        <button class="ok" class:danger={dialog.danger} bind:this={okBtn} onclick={() => answer(true)}>{dialog.confirmText}</button>
      </div>
      <small>Enter = ยืนยัน · Esc = ไม่ใช่</small>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed; inset: 0; z-index: 100; display: grid; place-items: center;
    background: rgba(15, 23, 42, 0.32); font-family: system-ui, sans-serif;
  }
  .modal {
    width: min(380px, calc(100vw - 32px)); padding: 20px; border-radius: 12px; background: #fff;
    box-shadow: 0 20px 48px rgba(15, 23, 42, 0.25); display: flex; flex-direction: column; gap: 10px;
  }
  h3 { margin: 0; font-size: 16px; color: #0f172a; }
  p { margin: 0; font-size: 13.5px; line-height: 1.6; color: #475569; white-space: pre-line; }
  .btns { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }
  button { border-radius: 8px; padding: 8px 16px; font: 600 13px system-ui, sans-serif; cursor: pointer; }
  .cancel { border: 1px solid #e2e8f0; background: #fff; color: #334155; }
  .cancel:hover { background: #f8fafc; }
  .ok { border: 0; background: #2563eb; color: #fff; }
  .ok:hover { background: #1d4ed8; }
  .ok.danger { background: #dc2626; }
  .ok.danger:hover { background: #b91c1c; }
  .ok:focus-visible { outline: 3px solid #fecaca; }
  small { text-align: right; font-size: 11px; color: #94a3b8; }
</style>
