/** Parse a typed number. Accepts a comma as the decimal separator. Returns null for empty or non-numeric input. */
export function parseNumber(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '' || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  return Number(t);
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
