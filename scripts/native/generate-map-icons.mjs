// Render the actual Vue pack icons into standalone SVG assets; no JS ships in the APK.
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root=fileURLToPath(new URL('../../',import.meta.url))
const require=createRequire(path.join(root,'frontend/package.json'))
const {createServer}=await import(pathToFileURL(require.resolve('vite')))
const {createSSRApp}=await import(pathToFileURL(require.resolve('vue')))
const {renderToString}=await import(pathToFileURL(require.resolve('@vue/server-renderer')))
const server=await createServer({root:path.join(root,'frontend'),configFile:path.join(root,'frontend/vite.config.js'),cacheDir:path.join(root,'build/map-icon-vite'),server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true}})
const source='frontend/src/features/maps/components/MapPackIcon.vue'
const output=path.join(root,'native/androidApp/src/main/assets/maps/packs')
const hash=data=>createHash('sha256').update(data).digest('hex')
try {
  const {default:Icon}=await server.ssrLoadModule('/src/features/maps/components/MapPackIcon.vue')
  await fs.mkdir(output,{recursive:true})
  const packages={}
  for(const pack of ['lost-cave','ultimate-dungeon','toxic-sewer','default']) {
    let svg=await renderToString(createSSRApp(Icon,{pack,size:48}))
    svg=svg.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ')
    const bytes=Buffer.from(svg+'\n')
    await fs.writeFile(path.join(output,pack+'.svg'),bytes)
    packages[pack+'.svg']=hash(bytes)
  }
  await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({source,sourceHash:hash(await fs.readFile(path.join(root,source))),packages},null,2)+'\n')
  console.log('Native pack icons rendered from Vue')
} finally {await server.close()}
