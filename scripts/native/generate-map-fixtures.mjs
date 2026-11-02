// Independent web oracle for the Kotlin map implementation. Run with frontend dependencies.
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
const root = fileURLToPath(new URL('../../', import.meta.url))
const require = createRequire(path.join(root, 'frontend/package.json'))
const { createServer } = await import(pathToFileURL(require.resolve('vite')))
const server = await createServer({ root:path.join(root,'frontend'), cacheDir:path.join(root,'build/map-fixture-vite'), configFile:path.join(root,'frontend/vite.config.js'), server:{middlewareMode:true}, appType:'custom', optimizeDeps:{noDiscovery:true} })
const results=[]
try {
  const base='/src/features/maps/lib/'
  const { newMap }=await server.ssrLoadModule(base+'mapModel.js')
  const { syncLights,lightPose }=await server.ssrLoadModule(base+'mapLighting.js')
  const { syncSurfaceObjects,surfacePosition }=await server.ssrLoadModule(base+'surfacePlacement.js')
  const { transitionDocument }=await server.ssrLoadModule(base+'modelTransitions.js')
  const model={id:'floor',definitionId:'F-floor',name:'Пол',collection:'test',tileType:'floor',category:'floor',width:2,height:1,canStand:true,mountDepth:0.1,placementOffset:[.05,-.02],surfaceHeight:.5,maxHeight:.6,supportSlots:[],placementPoints:[{x:.5,y:.5,elevation:.5},{x:1.5,y:.5,elevation:.5}],behaviour:{defaultLights:[{key:'torch',name:'Факел',kind:'torch',position:[.2,.5,1.8],color:'#ffc36a',intensity:8,radius:4.5,enabled:true,flicker:true,effect:{kind:'fire',size:[.2,.4],strength:.7,offset:[.1,0,-.2]}}],transitions:[]}}
  const object={...model,id:'prop',definitionId:'F-prop',tileType:'object',width:1,height:1,placementOffset:[0,0],supportSlots:[],placementPoints:[],behaviour:{...model.behaviour,defaultLights:model.behaviour.defaultLights.map(x=>({...x,key:'candle',position:[.8,.3,1]}))}}
  const target={...model,id:'changed',definitionId:'F-changed',placementPoints:[{x:1.4,y:.5,elevation:.55},{x:.4,y:.5,elevation:.55}],behaviour:{defaultLights:[],transitions:[]}}
  model.behaviour.transitions=[{id:'open',action:'open',toDefinitionId:'F-changed'}]
  const models=[model,object,target]
  const cleanIds=doc=>{for(const l of doc.lights||[])if(l.builtinKey)l.id=`${l.anchor.kind}:${l.anchor.id}:${l.builtinKey}`;return doc}
  for(const rotation of [0,90,180,270])for(const mirrored of [false,true]){
    const doc=newMap().document
    doc.tiles=[{id:'tile',modelId:'floor',x:4,y:5,rotation,level:0,...mirrored?{mirrored:true}:{}}]
    doc.objects=[{id:'object',kind:'chest',modelId:'prop',x:0,y:0,rotation:90,scale:1.5,open:false,placement:{tileId:'tile',point:0}}]
    const input=structuredClone(doc)
    syncSurfaceObjects(doc,models);syncLights(doc,models)
    results.push({kind:'normalize',input,models,expected:cleanIds(structuredClone(doc))})
    for(const light of doc.lights) results.push({kind:'lightPose',input:doc,models,light:structuredClone(light),expected:lightPose(light,doc,models)})
    results.push({kind:'surface',input:doc,models,tile:doc.tiles[0],point:model.placementPoints[1],elevation:1.25,expected:surfacePosition(doc.tiles[0],model,model.placementPoints[1],1.25)})
    const transition={id:'open',action:'open',toDefinitionId:'F-changed'}
    const result=transitionDocument(doc,models,'tile','tile',transition)
    results.push({kind:'transition',input:doc,models,key:'catalogue:floor:open',expected:result.valid?cleanIds(result.document):null,reason:result.reason})
  }
  const out=path.join(root,'native/fixtures/maps');await fs.mkdir(out,{recursive:true})
  await fs.writeFile(path.join(out,'web-operations.json'),JSON.stringify(results,null,2)+'\n')
  const {buildVolumeFogField,applyVolumeFogWeights}=await server.ssrLoadModule('/src/features/maps/rendering/volumeFogField.js')
  const {fireMotion}=await server.ssrLoadModule('/src/features/maps/rendering/fireMotion.js')
  const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
  const columns=[
    [{areaId:'A',min:[2,-.14,3],max:[4,1.5,4]}],
    [{areaId:'A',min:[0,-.14,0],max:[2,2.4,1]},{areaId:'A',min:[1,-.14,0],max:[3,2.4,1]},{areaId:'B',min:[2,.3,1],max:[3,3.2,3]}],
    [{areaId:'A',min:[1.4,-.4,2.7],max:[2.4,4,3.7]},{areaId:'B',min:[1.4,2.1,2.7],max:[2.4,6,3.7]}],
    [{areaId:'A',min:[0,-.14,0],max:[160,32,100]}],
  ]
  const fog=columns.map(input=>{const field=buildVolumeFogField(input),full=digest(field.data);applyVolumeFogWeights(field,id=>id==='A'?.371:.82);return {input,min:field.min,size:field.size,dimensions:field.dimensions,full,weighted:digest(field.data)}})
  const fire=[]
  for(const id of ['torch-1','f78dd1a3-6adc-4e13-84dd-8e06b814c39b'])for(const milliseconds of [0,50,84,1234,89000])for(const strength of [0,.7,2]) {
    const source={id,effect:{kind:'fire',size:[.22,.35],strength,offset:[0,0,-.175]}}
    fire.push({source,milliseconds,expected:fireMotion(source,milliseconds)})
  }
  const noise=new Uint8Array(32**3);let seed=0x1234abcd
  for(let i=0;i<noise.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;noise[i]=(seed>>>0)%256}
  await fs.writeFile(path.join(out,'web-effects.json'),JSON.stringify({fog,fire,noise:digest(noise)},null,2)+'\n')
  console.log(`Web map fixtures: ${results.length}; fog ${fog.length}; fire ${fire.length}`)
} finally { await server.close() }
