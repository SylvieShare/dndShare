import { compressedAssets } from './scripts/compressedAssets.mjs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue(), compressedAssets()],
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
    // deploy/deploy.sh copies this directory into internal/assets/dist before
    // building the embedded Go binary.
    outDir: 'target/dist',
    assetsDir: 'static',
    emptyOutDir: true,
    // Deployment retains hashed assets, including lazy chunks, across releases.
    manifest: true,
    cssCodeSplit: true,
  },
})
