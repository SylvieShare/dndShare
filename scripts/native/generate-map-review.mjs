// Export one web-owned scene/catalogue/GLB for paired native and browser review.
import {createRequire} from 'node:module'
import {fileURLToPath,pathToFileURL} from 'node:url'
import fs from 'node:fs/promises'
import path from 'node:path'
const root=fileURLToPath(new URL('../../',import.meta.url)),require=createRequire(path.join(root,'frontend/package.json'))
const {createServer}=await import(pathToFileURL(require.resolve('vite')))
globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.()}).catch(error=>this.onerror?.(error))}}
const server=await createServer({root:path.join(root,'frontend'),configFile:path.join(root,'frontend/vite.config.js'),cacheDir:path.join(root,'build/map-review-vite'),server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true}})
try {
 const {catalogue,glb,WALL,FLOOR}=await server.ssrLoadModule('/tests/maps/fixtures/catalogue.js')
 const {newMap}=await server.ssrLoadModule('/src/features/maps/lib/mapModel.js')
 const {canonicalMapData}=await server.ssrLoadModule('/src/shared/api/mapDocumentData.js')
 const map=newMap();map.id='test-map';map.name='Крепость на переправе';map.revision=1
 const doc=map.document;doc.width=12;doc.height=10;doc.tags=['подземелье','камень'];doc.tiles=[]
 for(let y=2;y<8;y++)for(let x=2;x<10;x++)doc.tiles.push({id:`tile-${x}-${y}`,modelId:x===2||x===9||y===2||y===7?WALL:FLOOR,x,y,level:0,rotation:0})
 doc.objects=[{id:'chest',kind:'chest',modelId:'ffffffff-ffff-4fff-8fff-ffffffffffff',x:4.5,y:4.5,rotation:0,scale:1,open:false,placement:{tileId:'tile-4-4',point:0}}]
 doc.areas=[{id:'hall',name:'Зал',color:'#9b84d8',hidden:false,fog:false,tileIds:doc.tiles.map(t=>t.id),objectIds:['chest']}]
 doc.cameras=[];doc.lights=[]
 const models=catalogue.map(({id,definitionId,...model})=>({...model,id:definitionId,uuid:id}))
 const output=path.join(root,'frontend/tests/maps/fixtures/data')
 await fs.writeFile(path.join(output,'editor-review.json'),JSON.stringify({map:canonicalMapData(map),models},null,2)+'\n')
 await fs.writeFile(path.join(output,'review-tile.glb'),Buffer.from(glb))
 console.log(`Paired map: ${doc.tiles.length} tiles, ${doc.objects.length} props, ${models.length} model definitions`)
}finally{await server.close()}
