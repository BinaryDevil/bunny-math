import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

// Relative base so the build works on GitHub Pages under any repo name.
export default defineConfig({
  base: './',
  plugins: [preact()],
  // Other sessions keep copies of the repo under .claude/worktrees; don't run their tests.
  test: { exclude: ['**/node_modules/**', '.claude/**'] },
});
