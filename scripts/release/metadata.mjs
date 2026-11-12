import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const root = fileURLToPath(new URL('../../', import.meta.url))
export const digest = data => createHash('sha256').update(data).digest('hex')
export function normalizedSourceBytes(name, bytes) {
  const text = /(?:^|\/)(?:go\.(?:mod|sum)|\.node-version|\.java-version|\.npmrc)$|\.(go|java|js|mjs|vue|json|css|kts|xml|sql|html|pem|properties|svg|md|txt)$/.test(name)
  return text ? Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n')) : bytes
}
export const readVersions = () => JSON.parse(fs.readFileSync(path.join(root, 'release/versions.json'), 'utf8'))
export function filesUnder(relative) {
  const output = []
  function visit(directory) {
    if (!fs.existsSync(path.join(root, directory))) return
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const name = `${directory}/${entry.name}`
      if (entry.isSymbolicLink()) throw new Error(`Symlinks are not release inputs: ${name}`)
      if (entry.isDirectory()) visit(name)
      else if (!/\.(test|spec)\.[^.]+$|_test\.go$/.test(name)) output.push(name)
    }
  }
  visit(relative)
  return output.sort()
}
function sourceHash(files, extra = {}) {
  const values = [...new Set(files)].sort().map(name => {
    const bytes = normalizedSourceBytes(name, fs.readFileSync(path.join(root, name)))
    return [name, digest(bytes)]
  })
  return digest(JSON.stringify({ files: values, extra }))
}
export function fingerprints(versions = readVersions()) {
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'frontend/package-lock.json'), 'utf8'))
  const nativeDependencies = Object.fromEntries(['@capacitor/android', '@capacitor/core'].map(name => [name, lock.packages[`node_modules/${name}`]]))
  const tabletWidth = JSON.parse(fs.readFileSync(path.join(root, 'design/tokens.json'), 'utf8')).layout.tablet
  const android = sourceHash([...filesUnder('native/androidApp/src/main'), 'native/.java-version', 'native/androidApp/build.gradle.kts', 'native/build.gradle.kts', 'native/settings.gradle.kts', 'native/gradle/wrapper/gradle-wrapper.properties', 'native/gradle/wrapper/gradle-wrapper.jar', 'release/frontend-ota-public.pem', 'scripts/release/metadata.mjs'], { nativeDependencies, tabletWidth, contracts: versions.contracts, updaterProtocol: 1 })
  const frontend = sourceHash([...filesUnder('frontend/src'), ...filesUnder('frontend/public'), ...filesUnder('design'), '.node-version', 'frontend/.npmrc', 'frontend/vite.config.js', 'frontend/index.html', 'frontend/package.json', 'frontend/package-lock.json', 'frontend/scripts/android-insets.mjs', 'frontend/scripts/design-media.mjs', 'frontend/scripts/compressedAssets.mjs', 'scripts/release/metadata.mjs'], { android, contracts: versions.contracts })
  const backend = sourceHash(['go.mod', 'go.sum', 'main.go', ...filesUnder('internal').filter(name => /\.(go|sql)$/.test(name) && !name.startsWith('internal/assets/dist/') && !name.startsWith('internal/web/testdata/'))], { apiContract: versions.contracts.api })
  return { backend, frontend, android }
}
export function buildMetadata() {
  const versions = readVersions()
  for (const part of ['frontend', 'backend', 'android']) {
    if (!/^\d+\.\d+\.\d+$/.test(versions[part].version) || !Number.isSafeInteger(versions[part].build) || versions[part].build < 1) throw new Error(`Invalid ${part} version`)
  }
  const hashes = fingerprints(versions)
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  return {
    frontend: { ...versions.frontend, commitSha: commit, sourceHash: hashes.frontend, nativeRuntime: hashes.android, apiContract: versions.contracts.api, dataContract: versions.contracts.data },
    backend: { ...versions.backend, commitSha: commit, sourceHash: hashes.backend, apiContract: versions.contracts.api },
    android: versions.android,
    publicKey: fs.readFileSync(path.join(root, 'release/frontend-ota-public.pem'), 'utf8').replaceAll('\r\n', '\n'),
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const metadata = buildMetadata()
  if (process.argv.includes('--go-flags')) console.log(`-s -w -X dndshare/internal/web.BuildCommit=${metadata.backend.commitSha} -X dndshare/internal/web.BuildVersion=${metadata.backend.version} -X dndshare/internal/web.BuildNumber=${metadata.backend.build} -X dndshare/internal/web.BuildAPIContract=${metadata.backend.apiContract}`)
  else if (process.argv.includes('--native-out')) {
    const versions = readVersions()
    if (!execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()) {
      const hashes = fingerprints(versions)
      if (Object.keys(hashes).some(part => hashes[part] !== versions.fingerprints[part])) throw new Error('Clean APK release has unversioned source changes')
    }
    const directory = process.argv[process.argv.indexOf('--native-out') + 1]
    const built = JSON.parse(fs.readFileSync(path.join(root, 'frontend/target/dist/build-info.json'), 'utf8'))
    for (const field of ['version', 'build', 'sourceHash', 'nativeRuntime']) if (built[field] !== metadata.frontend[field]) throw new Error('APK frontend output does not match source metadata')
    fs.mkdirSync(directory, { recursive: true })
    fs.writeFileSync(path.join(directory, 'client-runtime.json'), JSON.stringify({ format: 1, applicationId: 'ru.dndshare.client', ...metadata, frontend: built, updateUrl: 'https://dndshare.ru/api/frontend-updates/latest' }))
  } else console.log(JSON.stringify(metadata))
}
