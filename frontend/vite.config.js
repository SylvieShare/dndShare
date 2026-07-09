import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    // `.vue` is added so the existing extensionless `import X from '@/.../ViewX'`
    // imports keep resolving without touching ~130 call sites.
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json', '.vue'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/mcp': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  build: {
    // Matches the backend resource copy in backend/pom.xml (frontend/target/dist,
    // static/**, index.html, favicon.ico).
    outDir: 'target/dist',
    assetsDir: 'static',
    emptyOutDir: true,
    // Single JS + single CSS bundle on purpose — no per-route chunks, so an open
    // tab never 404s on a stale chunk after a deploy. The bundle is deliberately
    // over the default 500 kB hint, so raise the warning limit instead of chasing it.
    cssCodeSplit: false,
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      output: {
        codeSplitting: false,
      },
    },
  },
})
