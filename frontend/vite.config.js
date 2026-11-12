import { androidInsets } from './scripts/android-insets.mjs'
import { buildMetadata } from '../scripts/release/metadata.mjs'
import { designMedia } from './scripts/design-media.mjs'
import { compressedAssets } from './scripts/compressedAssets.mjs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

const build = buildMetadata()
export default defineConfig(({ isPreview }) => ({
  define: { __DNDSHARE_BUILD__: JSON.stringify(build.frontend) },
  cacheDir: process.env.DNDSHARE_VITE_CACHE || undefined,
  plugins: [vue(), { name: 'dndshare-build-info', generateBundle() { this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify(build.frontend) }) } }, compressedAssets()],
  css: { postcss: { plugins: [designMedia(), androidInsets()] } },
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
    outDir: isPreview && process.env.DNDSHARE_PREVIEW_DIST ? process.env.DNDSHARE_PREVIEW_DIST : 'target/dist',
    assetsDir: 'static',
    emptyOutDir: true,
    // Keep one JS bundle and one stylesheet: open tabs must not fetch a page
    // chunk from an older release after deployment.
    manifest: true,
    cssCodeSplit: false,
    rolldownOptions: {
      output: {
        codeSplitting: false,
      },
    },
  },
}))
