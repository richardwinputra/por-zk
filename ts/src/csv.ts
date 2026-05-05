import { promises as fs } from 'node:fs';

function escapeCell(v: unknown): string {
  if (v === undefined || v === null) return '';
  let s: string;
  if (typeof v === 'bigint') s = v.toString();
  else s = String(v);
  if (/[",\n]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export async function writeCsv(path: string, header: string[], rows: Record<string, unknown>[]): Promise<void> {
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(header.map(h => escapeCell(row[h])).join(','));
  }
  await fs.writeFile(path, lines.join('\n') + '\n');
}
