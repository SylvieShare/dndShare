import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bumpVersions, verifyEvolution, compareVersion } from './version-policy.mjs'
const initial = { backend:{version:'0.3.0',build:1},frontend:{version:'0.3.0',build:1},android:{version:'0.3.0',build:4},fingerprints:{backend:'b',frontend:'f',android:'a'} }
test('only changed components advance; a frontend re-release can be explicitly numbered', () => {
  const hashes={backend:'b',frontend:'new',android:'a'}
  const {versions}=bumpVersions(initial,hashes)
  assert.deepEqual(versions.backend,initial.backend)
  assert.deepEqual(versions.android,initial.android)
  assert.deepEqual(versions.frontend,{version:'0.3.1',build:2})
  verifyEvolution(versions,initial)
  assert.equal(bumpVersions(initial,initial.fingerprints,'frontend').versions.frontend.build,2)
})
test('release guard rejects forgotten bumps and compares numeric semver components', () => {
  assert.equal(compareVersion('0.3.10','0.3.9'),1)
  assert.throws(()=>verifyEvolution({...initial,fingerprints:{...initial.fingerprints,frontend:'new'}},initial))
  assert.throws(()=>verifyEvolution({...initial,frontend:{version:'0.2.9',build:9}},initial))
})
