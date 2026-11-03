// Export the web's procedural props as static GLB data. Three.js is a build-time tool only.
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import fs from 'node:fs/promises'
import path from 'node:path'
const root=fileURLToPath(new URL('../../',import.meta.url))
const require=createRequire(path.join(root,'frontend/package.json'))
const {createServer}=await import(pathToFileURL(require.resolve('vite')))
const {GLTFExporter}=await import(pathToFileURL(require.resolve('three/addons/exporters/GLTFExporter.js')))
// Node supplies Blob, while GLTFExporter expects the browser's FileReader callback contract.
globalThis.FileReader=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.()}).catch(error=>this.onerror?.(error))}
}
const server=await createServer({root:path.join(root,'frontend'),configFile:path.join(root,'frontend/vite.config.js'),cacheDir:path.join(root,'build/map-props-vite'),server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true}})
const source='frontend/src/features/maps/rendering/sceneObjects.js'
const output=path.join(root,'native/androidApp/src/main/resources/maps/builtin')
const kinds=['door','double-door','portcullis','barrel','crate','table','chest','torch','stairs','column','rubble','bridge']
const interactive=new Set(['door','double-door','portcullis','chest','torch'])
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
try {
  const {buildMapProp,disposeObjects}=await server.ssrLoadModule('/src/features/maps/rendering/sceneObjects.js')
  await fs.mkdir(output,{recursive:true})
  const packages={}
  for(const kind of kinds)for(const open of interactive.has(kind)?[false,true]:[false]) {
    const object=buildMapProp({id:'prop',kind,x:0,y:0,elevation:0,scale:1,rotation:0},open,{material:m=>m},null,'render')
    object.name=`${kind}-${open?'open':'closed'}`
    const data=await new GLTFExporter().parseAsync(object,{binary:true,onlyVisible:true})
    const bytes=Buffer.from(data)
    const name=object.name+'.glb'
    await fs.writeFile(path.join(output,name),bytes);packages[name]=hash(bytes)
    disposeObjects(object)
  }
  await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({source,sourceHash:hash(await fs.readFile(path.join(root,source))),packages},null,2)+'\n')
  await fs.writeFile(path.join(output,'SOURCES.md'),'# Процедурные объекты карт\n\nСгенерированы из `frontend/src/features/maps/rendering/sceneObjects.js` командой\n`node scripts/native/generate-map-props.mjs`. Геометрия и материалы повторяют веб.\nThree.js/GLTFExporter используются только при сборке этих статичных GLB;\nJavaScript и движок Three.js в APK не входят. Проверочные SHA-256 — в manifest.json.\n')
  console.log(`Exported ${Object.keys(packages).length} native map props from web geometry`)
}finally{await server.close()}
