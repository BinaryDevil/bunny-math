import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

// Relative base so the build works on GitHub Pages under any repo name.
export default defineConfig({
  base: './',
  plugins: [preact()],
  // Hand-me-down iPads stop at iPadOS 15 (iPad Air 2, mini 4), so keep the code loadable there.
  // Vite's default target (Safari 16.4) would leave newer syntax in that those Safaris can't parse.
  build: { target: ['es2020', 'safari15', 'ios15'] },
  // Other sessions keep copies of the repo under .claude/worktrees; don't run their tests.
  test: { exclude: ['**/node_modules/**', '.claude/**'] },
});
