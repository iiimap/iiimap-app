// หน้าต่างถามย้ำก่อนลบหรือยกเลิก (ใช้ทั้งเว็บ)
export const dialog = $state({
  open: false,
  title: '',
  message: '',
  confirmText: 'ลบ',
  danger: true
});

let resolver: ((ok: boolean) => void) | null = null;

/** เปิดหน้าต่างถามย้ำ คืน true ถ้าผู้ใช้กดยืนยัน */
export function ask(opts: { title: string; message?: string; confirmText?: string; danger?: boolean }): Promise<boolean> {
  resolver?.(false); // ถ้ามีหน้าต่างค้างอยู่ ถือว่ายกเลิกอันเก่า
  dialog.title = opts.title;
  dialog.message = opts.message ?? '';
  dialog.confirmText = opts.confirmText ?? 'ลบ';
  dialog.danger = opts.danger ?? true;
  dialog.open = true;
  return new Promise((res) => (resolver = res));
}

export function answer(ok: boolean) {
  dialog.open = false;
  const r = resolver;
  resolver = null;
  r?.(ok);
}
