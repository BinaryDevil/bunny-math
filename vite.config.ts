import { defineConfig, type Plugin } from 'vitest/config';
import preact from '@preact/preset-vite';
import { sitemap, worksheetPages } from './src/pages/worksheets';

/** Writes the static worksheet pages and sitemap.xml next to the app (see src/pages/worksheets.ts). */
function worksheetSite(): Plugin {
  return {
    name: 'worksheet-pages',
    apply: 'build',
    generateBundle(_, bundle) {
      const css = Object.keys(bundle).filter((f) => f.endsWith('.css'));
      for (const { path, html } of worksheetPages(css)) this.emitFile({ type: 'asset', fileName: path, source: html });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap() });
    },
  };
}

// Relative base so the build works on GitHub Pages under any repo name.
export default defineConfig({
  base: './',
  plugins: [preact(), worksheetSite()],
  // Hand-me-down iPads stop at iPadOS 15 (iPad Air 2, mini 4), so keep the code loadable there.
  // Vite's default target (Safari 16.4) would leave newer syntax in that those Safaris can't parse.
  build: { target: ['es2020', 'safari15', 'ios15'] },
  // Other sessions keep copies of the repo under .claude/worktrees; don't run their tests.
  // The leaderboard server in worker/ has its own tests, run from that folder.
  test: { exclude: ['**/node_modules/**', '.claude/**', 'worker/**'] },
});
