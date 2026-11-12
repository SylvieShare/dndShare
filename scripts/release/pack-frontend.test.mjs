import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, verify } from 'node:crypto'
import { unzipSync } from '../../frontend/node_modules/fflate/esm/index.mjs'
import { signedPackage } from './pack-frontend.mjs'
import { digest } from './metadata.mjs'

test('one archive has deterministic bytes, signed metadata and the complete file inventory', () => {
  const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const files = { 'index.html': Buffer.from('<html>app</html>'), 'static/app.js': Buffer.from('app()') }
  const first = signedPackage(files, { version: '0.3.0', build: 1 }, key.privateKey)
  const second = signedPackage(Object.fromEntries(Object.entries(files).reverse()), { version: '0.3.0', build: 1 }, key.privateKey)
  assert.deepEqual(first.archive, second.archive)
  const envelope = JSON.parse(first.envelope)
  const payload = Buffer.from(envelope.payload, 'base64')
  assert.equal(verify('sha256', payload, key.publicKey, Buffer.from(envelope.signature, 'base64')), true)
  const manifest = JSON.parse(payload)
  assert.equal(manifest.bundleSha256, digest(first.archive))
  assert.deepEqual(Object.keys(unzipSync(first.archive)).sort(), Object.keys(files).sort())
  assert.deepEqual(manifest.files.map(file => file.sha256), Object.values(files).map(digest))
  payload[0] ^= 1
  assert.equal(verify('sha256', payload, key.publicKey, Buffer.from(envelope.signature, 'base64')), false)
})
test('packager rejects unsafe paths and native executables', () => {
  const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  for (const name of ['../outside', '/absolute', 'static/../file', 'file.dex', 'native.so']) assert.throws(() => signedPackage({ 'index.html': Buffer.from('app'), [name]: Buffer.from('bad') }, {}, key.privateKey))
})
