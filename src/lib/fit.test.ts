import { describe, expect, it } from 'vitest';
import { largestFit } from './fit';

describe('largestFit', () => {
  it('finds the biggest size that fits, to the step', () => {
    expect(largestFit(12, 30, (u) => u * 10 <= 205)).toBe(20.5);
    expect(largestFit(12, 30, (u) => 17 * u + 50 <= 553)).toBe(29.5);
  });
  it('uses the biggest size when everything fits', () => {
    expect(largestFit(12, 30, () => true)).toBe(30);
  });
  it('says so when even the smallest size is too big', () => {
    expect(largestFit(12, 30, (u) => u < 10)).toBeNull();
  });
  it('never returns a size that does not fit, even if fitting is not monotonic', () => {
    const fits = (u: number) => u <= 14 || u === 22;
    const u = largestFit(12, 30, fits)!;
    expect(fits(u)).toBe(true);
  });
});
