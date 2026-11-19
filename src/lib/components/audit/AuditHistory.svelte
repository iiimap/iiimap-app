<script lang="ts">
  // ประวัติการตรวจของเป้าหมาย 1 ตัว (ใหม่สุดก่อน)
  import type { AuditModule } from '../../domain/types';
  import { auditHistory, fmtDate } from '../../domain/audit';
  import { app } from '../../stores/site.svelte';
  import { guarded } from '../../stores/guarded';

  let { module, targetId, limit = 5 }: { module: AuditModule; targetId: string; limit?: number } = $props();
  let all = $derived(auditHistory(app.site, module, targetId));
  let showAll = $state(false);
  let list = $derived(showAll ? all : all.slice(0, limit));
  let editable = $derived(app.mode === 'edit');
</script>

{#if all.length}
  <ul class="hist">
    {#each list as r (r.id)}
      {@const fails = Object.entries(r.checks).filter(([, ok]) => !ok).map(([k]) => k)}
      <li class:ng={!r.passed}>
        <div class="top">
          <b>{fmtDate(r.at)}</b>
          <span class="res">{#if r.score !== null}{r.score}% · {/if}{r.passed ? 'ผ่าน' : 'ไม่ผ่าน'}</span>
          {#if editable}<button class="x" title="ลบบันทึกนี้" aria-label="ลบบันทึกนี้" onclick={() => guarded.deleteAudit(r.id)}>×</button>{/if}
        </div>
        <small>ผู้ตรวจ {r.inspector}{#if fails.length} · ไม่ผ่าน: {fails.join(', ')}{/if}{#if r.note} · {r.note}{/if}</small>
      </li>
    {/each}
  </ul>
  {#if all.length > limit}
    <button class="more" onclick={() => (showAll = !showAll)}>{showAll ? 'ย่อ' : `ดูทั้งหมด ${all.length} ครั้ง`}</button>
  {/if}
{:else}
  <p class="none">ยังไม่มีประวัติการตรวจ</p>
{/if}

<style>
  .hist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-family: system-ui, sans-serif; }
  li { padding: 6px 8px; border-radius: 7px; background: #f8fafc; border-left: 3px solid #16a34a; }
  li.ng { border-left-color: #dc2626; background: #fef2f2; }
  .top { display: flex; align-items: center; gap: 8px; }
  .top b { font-size: 12.5px; color: #0f172a; }
  .res { font-size: 12px; color: #475569; }
  .x { margin-left: auto; width: 20px; height: 20px; padding: 0; border: 0; border-radius: 5px; background: transparent; color: #94a3b8; cursor: pointer; font-size: 14px; line-height: 1; }
  .x:hover { background: #fee2e2; color: #dc2626; }
  small { font-size: 11px; color: #64748b; }
  .more { align-self: flex-start; margin-top: 4px; border: 0; background: none; padding: 0; font: 12px system-ui, sans-serif; color: #2563eb; cursor: pointer; }
  .none { margin: 0; font-size: 12px; color: #94a3b8; font-family: system-ui, sans-serif; }
</style>
