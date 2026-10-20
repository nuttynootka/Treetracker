import { describe, expect, it } from 'vitest';
import { Clock, compareHlc, SEED_HLC } from '../../src/core/hlc';

describe('Clock', () => {
  it('produces strictly increasing stamps when time is frozen', () => {
    const c = new Clock('dev-a', () => 1000);
    const a = c.tick();
    const b = c.tick();
    const d = c.tick();
    expect(compareHlc(a, b)).toBeLessThan(0);
    expect(compareHlc(b, d)).toBeLessThan(0);
  });

  it('moves past a remote stamp from a clock that runs ahead', () => {
    const local = new Clock('dev-a', () => 1000);
    const remote = new Clock('dev-b', () => 1000 + 3_600_000).tick();
    local.receive(remote);
    expect(compareHlc(local.tick(), remote)).toBeGreaterThan(0);
  });

  it('breaks equal time and counter ties by device id', () => {
    const a = new Clock('aaa', () => 5).tick();
    const b = new Clock('bbb', () => 5).tick();
    expect(compareHlc(a, b)).toBeLessThan(0);
  });

  it('orders the seed stamp before any real stamp', () => {
    expect(compareHlc(SEED_HLC, new Clock('x', () => 1).tick())).toBeLessThan(0);
  });
});
