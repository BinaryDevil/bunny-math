/**
 * Cheap guards for the header-overlap bug (the Japanese title covered the top bar on iPhone).
 * The real check runs in a browser: `npm run test:e2e`. These only make sure the key rules stay.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
/** The declarations of the first top-level rule whose selector is exactly `sel`. */
function rule(sel: string): string {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(`(?:^|\\n)${esc}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`no rule for ${sel}`);
  return m[1];
}

describe('home and mode screens never push content over the top bar', () => {
  it('centres with auto margins, not justify-content: center (which overflows upwards)', () => {
    expect(rule('.home-body')).not.toMatch(/justify-content:\s*center/);
    expect(rule('.mode-body')).not.toMatch(/justify-content:\s*center/);
    expect(css).toMatch(/\.home-body > :first-child, \.mode-body > :first-child \{ margin-top: auto; \}/);
    expect(rule('.home-body, .mode-body')).toMatch(/overflow-y:\s*auto/);
  });

  it('keeps the top bar on top and unshrinkable', () => {
    const bar = rule('.topbar');
    expect(bar).toMatch(/position:\s*relative/);
    expect(bar).toMatch(/z-index:\s*[1-9]/);
    expect(bar).toMatch(/flex:\s*none/);
  });

  it('sizes the title by width too, and never breaks inside a word', () => {
    expect(rule('.title')).toMatch(/font-size:\s*clamp\([^;]*vw/);
    expect(rule('.title span')).toMatch(/white-space:\s*nowrap/);
    expect(rule('.levels')).toMatch(/minmax\(0,\s*1fr\)/);
  });
});

describe('quiz screen never pushes the question card over the keypad or the top bar', () => {
  it('centres the card with auto margins and lets the pane scroll', () => {
    const pane = css.match(/\n\.q-pane \{([^}]*)\}/)![1];
    expect(pane).not.toMatch(/justify-content:\s*center/);
    expect(pane).toMatch(/overflow-y:\s*auto/);
    expect(css).toMatch(/\.q-pane > \.q-card \{ margin-block: auto; \}/);
  });

  it('fits the equation to its digit count', () => {
    expect(css).toMatch(/\.equation \{[^}]*font-size:[^;]*var\(--digits/);
  });

  it('lets the explanation sheet scroll, so Next stays reachable', () => {
    expect(css).toMatch(/\n\.sheet \{[^}]*overflow-y:\s*auto/);
  });
});
