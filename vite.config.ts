import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Relative base so the build works on GitHub Pages under any repo name.
export default defineConfig({
  base: './',
  plugins: [preact()],
});
