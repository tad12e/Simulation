/**
 * Download text content (e.g. CSV) as a client-side file without popup windows.
 */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escapeCell = (val: string | number): string => {
    const str = typeof val === 'number' ? (Number.isFinite(val) ? String(val) : '') : val;
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export an HTMLCanvasElement as a high-DPI PNG image.
 */
export function downloadCanvasPng(canvas: HTMLCanvasElement | null, filename: string): void {
  if (!canvas) return;
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
