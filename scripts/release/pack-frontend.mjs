import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createPrivateKey, createPublicKey, sign } from 'node:crypto'
import { zipSync } from '../../frontend/node_modules/fflate/esm/index.mjs'
import { buildMetadata, digest, root } from './metadata.mjs'

export function signedPackage(files, metadata, privateKey) {
  const entries = Object.entries(files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
  if (entries.length > 2048 || entries.some(([, bytes]) => bytes.length > 32 * 1024 * 1024) || entries.reduce((sum, [, bytes]) => sum + bytes.length, 0) > 128 * 1024 * 1024) throw new Error('Frontend package exceeds native limits')
  for (const [name] of entries) if (!/^[A-Za-z0-9_./-]+$/.test(name) || name.split('/').some(part => !part || part === '..' || part === '.') || /\.(dex|apk|jar|class|so|dylib)$/i.test(name)) throw new Error(`Invalid frontend path: ${name}`)
  if (!files['index.html']) throw new Error('Missing frontend entrypoint')
  const archive = Buffer.from(zipSync(Object.fromEntries(entries), { level: 9, mtime: new Date(2020, 0, 1) }))
  if (archive.length > 64 * 1024 * 1024) throw new Error('Frontend archive exceeds native download limit')
  const payload = Buffer.from(JSON.stringify({ format: 1, applicationId: 'ru.dndshare.client', ...metadata, bundleSha256: digest(archive), bundleBytes: archive.length, unpackedBytes: entries.reduce((sum, [, bytes]) => sum + bytes.length, 0), files: entries.map(([name, bytes]) => ({ path: name, size: bytes.length, sha256: digest(bytes) })) }))
  return { archive, envelope: Buffer.from(JSON.stringify({ payload: payload.toString('base64'), signature: sign('sha256', payload, privateKey).toString('base64') })) }
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.join(root, 'scripts/release/pack-frontend.mjs')) {
  const metadata = buildMetadata()
  const privatePath = process.env.DNDSHARE_FRONTEND_SIGNING_KEY || path.join(os.homedir(), '.codex/secrets/dndshare-frontend-ota-private.pem')
  if (!fs.existsSync(privatePath)) throw new Error('Frontend signing key is missing. Set DNDSHARE_FRONTEND_SIGNING_KEY to its private PEM path.')
  const key = createPrivateKey(fs.readFileSync(privatePath))
  if (createPublicKey(key).export({ type: 'spki', format: 'pem' }).trim() !== metadata.publicKey.trim()) throw new Error('Signing key does not match the APK public key')
  const directory = path.join(root, 'frontend/target/dist')
  const built = JSON.parse(fs.readFileSync(path.join(directory, 'build-info.json'), 'utf8'))
  for (const field of ['version', 'build', 'sourceHash', 'nativeRuntime']) if (built[field] !== metadata.frontend[field]) throw new Error('Frontend output does not match release source metadata')
  const files = {}
  function visit(relative = '') {
    for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name
      if (entry.isSymbolicLink()) throw new Error('Symlinks cannot be shipped')
      if (entry.isDirectory()) visit(name)
      else if (!/\.(gz|br)$/.test(name)) files[name] = new Uint8Array(fs.readFileSync(path.join(directory, name)))
    }
  }
  visit()
  const bundle = signedPackage(files, metadata.frontend, key)
  const output = path.join(root, 'internal/clientrelease/updates')
  fs.mkdirSync(output, { recursive: true })
  for (const name of fs.readdirSync(output)) if (name !== '.gitkeep') fs.unlinkSync(path.join(output, name))
  fs.writeFileSync(path.join(output, 'latest.json'), bundle.envelope)
  fs.writeFileSync(path.join(output, `${digest(bundle.archive)}.zip`), bundle.archive)
  console.log(`Signed frontend ${metadata.frontend.version}+${metadata.frontend.build}: ${bundle.archive.length} bytes`)
}
