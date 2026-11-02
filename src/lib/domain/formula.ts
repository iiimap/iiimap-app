// ตัวคำนวณสูตรแบบปลอดภัย (ไม่ใช้ eval ไม่รันโค้ดใดๆ)
// รองรับ: ตัวเลข, ตัวแปร, + - * /, วงเล็บ, เครื่องหมายลบหน้าตัวเลข

export const METRIC_VARIABLES = [
  { id: 'repairTime', label: 'เวลาซ่อมรวม (นาที)', sample: 180 },
  { id: 'failures', label: 'จำนวนครั้งที่เสีย', sample: 4 },
  { id: 'runTime', label: 'เวลาเดินเครื่องรวม (นาที)', sample: 9600 },
  { id: 'plannedTime', label: 'เวลาตามแผนการผลิต (นาที)', sample: 10080 },
  { id: 'downTime', label: 'เวลาหยุดรวมทุกสาเหตุ (นาที)', sample: 480 },
  { id: 'responseTime', label: 'เวลาตอบสนองรวม (นาที)', sample: 40 }
] as const;

type Tok = { t: 'num'; v: number } | { t: 'var'; v: string } | { t: 'op'; v: string } | { t: '('} | { t: ')' };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const n = Number(src.slice(i, j));
      if (!Number.isFinite(n)) throw new Error(`ตัวเลขไม่ถูกต้อง: ${src.slice(i, j)}`);
      out.push({ t: 'num', v: n });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ t: 'var', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if ('+-*/'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    if (c === '(') { out.push({ t: '(' }); i++; continue; }
    if (c === ')') { out.push({ t: ')' }); i++; continue; }
    throw new Error(`ใช้ตัวอักษร "${c}" ในสูตรไม่ได้`);
  }
  return out;
}

// แปลงเป็นต้นไม้คำนวณ (recursive descent)
type Node = { k: 'num'; v: number } | { k: 'var'; v: string } | { k: 'neg'; a: Node } | { k: 'bin'; op: string; a: Node; b: Node };

function parse(tokens: Tok[], vars: Set<string>): Node {
  let p = 0;
  const peek = () => tokens[p];

  function expr(): Node {
    let n = term();
    while (peek()?.t === 'op' && ((peek() as any).v === '+' || (peek() as any).v === '-')) {
      const op = (tokens[p++] as any).v;
      n = { k: 'bin', op, a: n, b: term() };
    }
    return n;
  }
  function term(): Node {
    let n = unary();
    while (peek()?.t === 'op' && ((peek() as any).v === '*' || (peek() as any).v === '/')) {
      const op = (tokens[p++] as any).v;
      n = { k: 'bin', op, a: n, b: unary() };
    }
    return n;
  }
  function unary(): Node {
    if (peek()?.t === 'op' && (peek() as any).v === '-') {
      p++;
      return { k: 'neg', a: unary() };
    }
    return atom();
  }
  function atom(): Node {
    const tk = tokens[p++];
    if (!tk) throw new Error('สูตรไม่ครบ');
    if (tk.t === 'num') return { k: 'num', v: tk.v };
    if (tk.t === 'var') {
      if (!vars.has(tk.v)) throw new Error(`ไม่รู้จักตัวแปร "${tk.v}"`);
      return { k: 'var', v: tk.v };
    }
    if (tk.t === '(') {
      const n = expr();
      if (tokens[p++]?.t !== ')') throw new Error('วงเล็บไม่ครบคู่');
      return n;
    }
    throw new Error('สูตรไม่ถูกต้อง');
  }

  if (tokens.length === 0) throw new Error('ยังไม่ได้ใส่สูตร');
  const root = expr();
  if (p < tokens.length) throw new Error('สูตรไม่ถูกต้อง');
  return root;
}

function run(n: Node, values: Record<string, number>): number {
  switch (n.k) {
    case 'num': return n.v;
    case 'var': return values[n.v] ?? 0;
    case 'neg': return -run(n.a, values);
    case 'bin': {
      const a = run(n.a, values);
      const b = run(n.b, values);
      if (n.op === '+') return a + b;
      if (n.op === '-') return a - b;
      if (n.op === '*') return a * b;
      return b === 0 ? NaN : a / b; // หารศูนย์ = ไม่มีค่า
    }
  }
}

const VAR_IDS = new Set<string>(METRIC_VARIABLES.map((v) => v.id));

/** ตรวจสูตร: คืนข้อความ error หรือ null ถ้าถูกต้อง */
export function checkFormula(src: string): string | null {
  try {
    parse(tokenize(src), VAR_IDS);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

/** คำนวณสูตร คืน NaN ถ้าสูตรผิดหรือหารศูนย์ */
export function evalFormula(src: string, values: Record<string, number>): number {
  try {
    return run(parse(tokenize(src), VAR_IDS), values);
  } catch {
    return NaN;
  }
}

export const SAMPLE_VALUES: Record<string, number> = Object.fromEntries(METRIC_VARIABLES.map((v) => [v.id, v.sample]));
