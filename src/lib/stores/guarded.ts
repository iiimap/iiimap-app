// คำสั่งลบ / ยกเลิกที่ต้องถามย้ำก่อนทุกครั้ง (ปุ่มและคีย์ลัดทุกที่เรียกผ่านไฟล์นี้)
import { app, actions, kpiFormDirty } from './site.svelte';
import { ask } from './confirm.svelte';

const assetName = (id: string) => app.site.assets.find((a) => a.id === id)?.name ?? '';
const lineName = (id: string) => app.site.lines.find((l) => l.id === id)?.name ?? '';
const stateName = (id: string) => app.site.andonStates.find((s) => s.id === id)?.name ?? '';

export const guarded = {
  /** เพิ่มเครื่องเข้าไลน์: ถ้าอยู่ไลน์อื่นแล้ว ถามก่อนว่าจะย้ายไหม */
  async addToLine(assetId: string, lineId: string) {
    const a = app.site.assets.find((x) => x.id === assetId);
    if (!a || a.lineId === lineId) return;
    if (a.lineId) {
      const ok = await ask({
        title: `ย้าย ${a.name} ไป ${lineName(lineId)}?`,
        message: `${a.name} อยู่ใน ${lineName(a.lineId)} แล้ว\nเครื่องหนึ่งตัวอยู่ได้ไลน์เดียว ถ้าย้าย จะออกจาก ${lineName(a.lineId)}`,
        confirmText: 'ย้าย',
        danger: false
      });
      if (!ok) return;
    }
    actions.addToLine(assetId, lineId);
  },

  /** คลิกเครื่องบนผังในโหมดเลือก: อยู่ไลน์นี้แล้ว = เอาออก, ยังไม่อยู่ = เพิ่ม (ถามถ้าต้องย้าย) */
  async toggleMember(assetId: string, lineId: string) {
    const a = app.site.assets.find((x) => x.id === assetId);
    if (!a) return;
    if (a.lineId === lineId) actions.removeFromLine(assetId);
    else await guarded.addToLine(assetId, lineId);
  },

  async removeAsset(id: string) {
    if (await ask({ title: `ลบ ${assetName(id)}?`, message: 'เครื่องนี้จะถูกลบออกจากผัง (กด Ctrl+Z เพื่อย้อนกลับได้)' }))
      actions.remove(id);
  },

  async deleteLine(id: string) {
    const n = app.site.assets.filter((a) => a.lineId === id).length;
    if (await ask({ title: `ลบ ${lineName(id)}?`, message: `ไลน์จะถูกลบ เครื่อง ${n} ตัวในไลน์จะไม่อยู่ในไลน์ใดๆ\n(ตัวเครื่องยังอยู่บนผัง)` }))
      actions.deleteLine(id);
  },

  async cancelDraft() {
    if (!app.draftLineId) return;
    if (await ask({ title: `ยกเลิกการสร้าง ${lineName(app.draftLineId)}?`, message: 'ไลน์ที่ยังไม่บันทึกจะหายไป เครื่องที่เลือกไว้จะกลับไปไลน์เดิม', confirmText: 'ยกเลิกไลน์' }))
      actions.cancelDraft();
  },

  async removeFromLine(assetId: string) {
    const a = app.site.assets.find((x) => x.id === assetId);
    if (!a?.lineId) return;
    if (await ask({ title: `เอา ${a.name} ออกจาก ${lineName(a.lineId)}?`, confirmText: 'เอาออก' })) actions.removeFromLine(assetId);
  },

  async deleteAndonState(id: string) {
    const n = app.site.assets.filter((a) => a.andon && a.status === id).length;
    if (await ask({ title: `ลบสถานะ "${stateName(id)}"?`, message: n ? `เครื่อง ${n} ตัวที่อยู่ในสถานะนี้จะกลับเป็นสถานะระดับต่ำสุด` : '' }))
      actions.deleteAndonState(id);
  },

  async resetAndonStates() {
    if (await ask({ title: 'คืนค่าสถานะเริ่มต้น?', message: 'ชื่อ สี และระดับที่ตั้งเองทั้งหมดจะถูกแทนด้วยค่าเริ่มต้น', confirmText: 'คืนค่า' }))
      actions.resetAndonStates();
  },

  async deleteKpi(id: string) {
    const k = app.site.kpis.find((x) => x.id === id);
    if (!k) return;
    if (await ask({ title: `ลบ KPI "${k.name}"?`, message: 'KPI นี้และสูตรจะถูกลบ (กด Ctrl+Z เพื่อย้อนกลับได้)' })) actions.deleteKpi(id);
  },

  /** ปิดฟอร์ม KPI: ถ้ามีการแก้ที่ยังไม่บันทึก ถามก่อน คืน true ถ้าปิดแล้ว */
  async closeKpiForm(): Promise<boolean> {
    const f = app.kpiForm;
    if (!f) return true;
    if (kpiFormDirty()) {
      const ok = await ask(
        f.id
          ? { title: `ยกเลิกการแก้ไข "${f.name || 'KPI'}"?`, message: 'สิ่งที่แก้ไว้แต่ยังไม่บันทึกจะหายไป', confirmText: 'ยกเลิกการแก้ไข' }
          : { title: 'ยกเลิกการสร้าง KPI?', message: 'KPI ที่ยังไม่บันทึกจะหายไป', confirmText: 'ยกเลิก KPI' }
      );
      if (!ok) return false;
    }
    actions.closeKpiForm();
    return true;
  },

  /** เปิด KPI อื่น: ปิดฟอร์มเดิมก่อน (ถามถ้ายังไม่บันทึก) / กด KPI เดิมซ้ำ = ปิด */
  async openKpi(id: string) {
    const same = app.kpiForm?.id === id;
    if (!(await guarded.closeKpiForm())) return;
    if (!same) actions.openKpi(id);
  },

  async resetKpis() {
    if (await ask({ title: 'คืน KPI เริ่มต้น?', message: 'KPI ทั้งหมดที่สร้างหรือแก้ไว้จะถูกแทนด้วย MTTR และ MTBF แบบมาตรฐาน', confirmText: 'คืนค่า' }))
      actions.resetKpis();
  }
};
