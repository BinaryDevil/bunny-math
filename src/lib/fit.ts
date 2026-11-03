/**
 * The largest size in [min, max] (to `step`) for which `fits(size)` is true, or null if even `min`
 * doesn't fit. Assumes smaller sizes fit at least as well as bigger ones, but double-checks the answer.
 */
export function largestFit(min: number, max: number, fits: (size: number) => boolean, step = 0.5): number | null {
  if (fits(max)) return max;
  if (!fits(min)) return null;
  let lo = min; // fits
  let hi = max; // doesn't fit
  while (hi - lo > step) {
    const mid = Math.round((lo + hi) / 2 / step) * step;
    if (mid <= lo || mid >= hi) break;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  // If fitting wasn't monotonic, walk down until it really fits.
  while (lo > min && !fits(lo)) lo = Math.max(min, lo - step);
  return lo;
}
