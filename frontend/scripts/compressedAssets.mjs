import fs from 'node:fs/promises'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

// Run after final hashes and import URLs have been written by Vite.
export function compressedAssets() {
  let output
  return {
    name: 'compressed-static-assets',
    apply: 'build',
    configResolved(config) { output = path.resolve(config.root, config.build.outDir) },
    async closeBundle() {
      const files = await fs.readdir(output, { recursive: true })
      await Promise.all(files.filter(file => /\.(js|css)$/.test(file)).map(async file => {
        const target = path.join(output, file)
        await fs.writeFile(target + '.gz', gzipSync(await fs.readFile(target), { level: 9 }))
      }))
    },
  }
}
