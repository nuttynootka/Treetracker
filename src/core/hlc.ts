import type { Hlc } from './types';

// Format: 15-digit milliseconds : 6-digit counter : device id.
// Fixed-width numbers make plain string comparison match time order.
export const SEED_HLC: Hlc = '000000000000000:000000:seed';

const format = (ms: number, counter: number, deviceId: string): Hlc =>
  `${ms.toString().padStart(15, '0')}:${counter.toString().padStart(6, '0')}:${deviceId}`;

function parse(h: Hlc): { ms: number; counter: number } {
  const [ms, counter] = h.split(':');
  return { ms: Number(ms), counter: Number(counter) };
}

export function compareHlc(a: Hlc, b: Hlc): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export class Clock {
  private ms = 0;
  private counter = 0;

  constructor(
    private readonly deviceId: string,
    private readonly now: () => number = Date.now,
  ) {}

  tick(): Hlc {
    const t = this.now();
    if (t > this.ms) {
      this.ms = t;
      this.counter = 0;
    } else {
      this.counter++;
    }
    return format(this.ms, this.counter, this.deviceId);
  }

  receive(remote: Hlc): void {
    const r = parse(remote);
    const t = this.now();
    const ms = Math.max(this.ms, r.ms, t);
    if (ms === this.ms && ms === r.ms) this.counter = Math.max(this.counter, r.counter) + 1;
    else if (ms === this.ms) this.counter++;
    else if (ms === r.ms) this.counter = r.counter + 1;
    else this.counter = 0;
    this.ms = ms;
  }
}
