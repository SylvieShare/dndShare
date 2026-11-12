import fs from 'node:fs'
import path from 'node:path'
import { generateKeyPairSync, sign } from 'node:crypto'
import { zipSync } from '../../frontend/node_modules/fflate/esm/index.mjs'
import { signedPackage } from './pack-frontend.mjs'
import { digest } from './metadata.mjs'

const output = process.argv[2]
if (!output) throw new Error('Choose the generated test asset directory')
fs.mkdirSync(output, { recursive: true })
const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const base = { version: '0.0.1', build: 1, commitSha: 'fixture', sourceHash: 'e'.repeat(64), nativeRuntime: 'a'.repeat(64), apiContract: 1, dataContract: 1 }
fs.writeFileSync(path.join(output, 'runtime.json'), JSON.stringify({ format: 1, applicationId: 'ru.dndshare.client', frontend: base, android: { version: 'fixture', build: 1 }, publicKey: key.publicKey.export({ type: 'spki', format: 'pem' }), updateUrl: 'https://dndshare.ru/api/frontend-updates/latest' }))
const good = Buffer.from(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="ota-good">Verified OTA</div><script>window.fixtureEvents=['parsed'];window.addEventListener('error',event=>window.fixtureError=event.message);window.addEventListener('load',()=>{window.fixtureEvents.push('load');(async()=>{const updater=window.Capacitor.Plugins.FrontendUpdater;const status=await updater.getStatus();window.fixtureStatus=status;await updater.ready({bootToken:status.bootToken,build:2,sourceHash:'${'b'.repeat(64)}'});window.fixtureReady=true;})().catch(error=>window.fixtureError=error.message);});</script></body></html>`)
for (const [name, build, hash, html] of [['good',2,'b',good],['bad',3,'c',Buffer.from('<html><body><div id="ota-bad">No ready signal</div></body></html>')],['crash',4,'d',Buffer.from('<html><body><div id="ota-crash">No ready signal</div></body></html>')]]) {
  const bundle = signedPackage({ 'index.html': html }, { ...base, version: `0.0.${build}`, build, sourceHash: hash.repeat(64) }, key.privateKey)
  fs.writeFileSync(path.join(output, `${name}.zip`),bundle.archive)
  fs.writeFileSync(path.join(output, `${name}.json`),bundle.envelope)
}
const evil = Buffer.from(zipSync({ 'index.html': new Uint8Array(good), '../escaped.txt': new Uint8Array([1]) }))
const payload = Buffer.from(JSON.stringify({ format: 1, applicationId: 'ru.dndshare.client', ...base, build: 5, bundleSha256: digest(evil), bundleBytes: evil.length, unpackedBytes: good.length, files: [{ path:'index.html', size:good.length, sha256:digest(good) }] }))
fs.writeFileSync(path.join(output,'unsafe.zip'),evil)
fs.writeFileSync(path.join(output,'unsafe.json'),JSON.stringify({ payload:payload.toString('base64'), signature:sign('sha256',payload,key.privateKey).toString('base64') }))
