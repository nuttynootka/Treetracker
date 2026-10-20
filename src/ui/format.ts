export const fmtIn = (n: number) => `${n.toFixed(1)} in`;
export const sizeLabel = (lengthFt: number, circ: number) => `${lengthFt} ft · ${circ.toFixed(1)} in around`;

export function ago(ms: number | undefined): string {
  if (!ms) return 'never';
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

export const dateText = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
