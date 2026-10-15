/** The web build's way of handing a file over: a download (and the browser's print dialog for a PDF). */

export function safeName(name: string): string {
  return name.replace(/[/\\\u0000-\u001f:*?"<>|]+/g, '-').trim() || 'file';
}

export async function shareFile(content: Blob | string, name: string, type: string): Promise<void> {
  const blob = typeof content === 'string' ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName(name);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** The page in a new window, with the browser's print dialog (Save as PDF). */
export async function sharePdf(html: string): Promise<void> {
  const w = window.open('', '_blank');
  if (!w) throw new Error('The browser blocked the new window.');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

export const canSave = false;

export async function saveFile(content: Blob, name: string, type: string): Promise<string> {
  await shareFile(content, name, type);
  return 'Downloads';
}
