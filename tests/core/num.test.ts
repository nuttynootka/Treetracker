import { describe, expect, it } from 'vitest';
import { parseNumber, round1 } from '../../src/core/num';

describe('parseNumber', () => {
  it('parses a dot decimal', () => expect(parseNumber('12.6')).toBe(12.6));
  it('accepts a comma as the decimal separator', () => expect(parseNumber('12,6')).toBe(12.6));
  it('trims whitespace', () => expect(parseNumber(' 34 ')).toBe(34));
  it('rejects empty input', () => expect(parseNumber('')).toBeNull());
  it('rejects non-numbers', () => expect(parseNumber('abc')).toBeNull());
});

describe('round1', () => {
  it('rounds to one decimal place', () => expect(round1(28.27)).toBe(28.3));
});
