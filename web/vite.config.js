import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `npm run build`       → dist/       served by the Python server
// `npm run build:demo`  → dist-demo/  one self-contained HTML file with simulated colleagues
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react()],
  build: mode === 'demo'
    ? { outDir: 'dist-demo', assetsInlineLimit: 100_000_000, cssCodeSplit: false, modulePreload: false }
    : { outDir: 'dist' },
  server: {
    // `npm run dev` talks to the Python server running on port 8000
    proxy: { '/ws': { target: 'ws://127.0.0.1:8000', ws: true } },
  },
}))
