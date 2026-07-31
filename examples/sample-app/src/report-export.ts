/**
 * Heavy, rarely used helpers that consumers pull in on demand with
 * `await import('./report-export')` rather than at module load.
 */

/** Serialize rows to CSV text. */
export function toCsv(rows: Array<Record<string, string | number>>): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const body = rows.map((r) => headers.map((h) => String(r[h] ?? '')).join(','));
  return [headers.join(','), ...body].join('\n');
}

/** Trigger a browser download for the given CSV text. */
export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
