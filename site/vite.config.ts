import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` keeps every asset reference relative, so the build works whether
// it's served at a domain root or under a GitHub Pages project sub-path. Routing
// uses HashRouter (see App.tsx) so deep links resolve without server rewrites.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
});
