import { test } from 'node:test'
import assert from 'node:assert/strict'
import { digest, normalizedSourceBytes } from './metadata.mjs'

test('source fingerprints agree across Windows and Linux text checkouts', () => {
  for (const name of ['go.mod', 'go.sum', '.node-version', 'native/.java-version', 'frontend/.npmrc', 'internal/example.go', 'frontend/example.vue', 'release/key.pem']) {
    assert.equal(digest(normalizedSourceBytes(name, Buffer.from('one\r\ntwo\r\n'))),
      digest(normalizedSourceBytes(name, Buffer.from('one\ntwo\n'))), name)
  }
})

test('binary media and non-Go mod files remain byte-exact', () => {
  const binary = Buffer.from([0, 13, 10, 255, 13, 10])
  for (const name of ['image.png', 'model.glb', 'audio.mod']) assert.deepEqual(normalizedSourceBytes(name, binary), binary)
})
