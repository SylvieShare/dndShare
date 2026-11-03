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
    syncSurfaceObjects(doc,models);syncLights(doc,models);cleanIds(doc)
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
  const {groupRotationPivot,rotateMapGroup}=await server.ssrLoadModule(base+'mapGroupRotation.js')
  const {mirrorTileGroup}=await server.ssrLoadModule(base+'mapGroupMirror.js')
  const groupModels=[{...model,id:'A',definitionId:'D-A',width:1,height:2},{...model,id:'B',definitionId:'D-B',width:2,height:1},{...model,id:'C',definitionId:'D-C',width:2,height:2}]
  const groups=[]
  for(const angle of [0,90,180,270])for(const offset of [0,3]) {
    const tiles=[{id:'one',modelId:'A',x:4+offset,y:3,rotation:angle,level:0},{id:'two',modelId:'B',x:6+offset,y:4,rotation:(angle+90)%360,level:1},{id:'three',modelId:'C',x:3+offset,y:6,rotation:0,level:0}]
    const objects=[{id:'same',x:4.3+offset,y:5.7,rotation:15,scale:1}]
    const pivot=groupRotationPivot(tiles,objects,groupModels)
    groups.push({tiles,objects,models:groupModels,pivot,rotated:rotateMapGroup(tiles,objects,groupModels,pivot),mirrored:mirrorTileGroup(tiles,groupModels)})
  }
  await fs.writeFile(path.join(out,'web-groups.json'),JSON.stringify(groups,null,2)+'\n')
  const {nearestTilePlacement}=await server.ssrLoadModule(base+'tilePlacement.js')
  const {enclosedEmptyCells}=await server.ssrLoadModule(base+'enclosedTiles.js')
  const floor={...model,id:'floor',definitionId:'F-floor',width:1,height:1,mountDepth:0,placementOffset:[0,0],behaviour:{defaultLights:[],transitions:[]},supportSlots:[{x:0,y:0,width:1,height:1,elevation:.5,insertionRise:.25}]}
  const bridge={...floor,id:'bridge',definitionId:'F-bridge',width:2,height:1,mountDepth:.1,supportSlots:[]}
  const placementModels=[floor,bridge]
  const board=newMap().document;board.width=6;board.height=6;board.tiles=[{id:'base',modelId:'floor',x:2,y:2,rotation:0,level:0}]
  const nearest=[]
  for(const modelId of ['floor','bridge'])for(const rotation of [0,90])for(const level of [0,1]) {
    const tile={id:'new',modelId,x:2.1,y:2.1,rotation,level}
    nearest.push({document:structuredClone(board),models:placementModels,tile,expected:nearestTilePlacement(board,tile,placementModels)})
  }
  for(const [x,y] of [[-.2,-.2],[5.7,5.7],[1.3,2],[20,20]]) {
    const tile={id:'new',modelId:'bridge',x,y,rotation:0,level:1}
    nearest.push({document:structuredClone(board),models:placementModels,tile,expected:nearestTilePlacement(board,tile,placementModels)})
  }
  const room=newMap().document;room.width=7;room.height=7;room.tiles=[]
  for(let y=1;y<=5;y++)for(let x=1;x<=5;x++)if(x===1||x===5||y===1||y===5)room.tiles.push({id:`wall-${x}-${y}`,modelId:'floor',x,y,rotation:0,level:0})
  const fills=[]
  for(const document of [room,{...room,tiles:room.tiles.filter(t=>t.id!=='wall-1-3')},{...room,tiles:[...room.tiles,{id:'obstacle',modelId:'bridge',x:2,y:2,rotation:0,level:0}]}]) {
    const point={x:3.4,y:3.4}
    fills.push({document,models:placementModels,point,expected:enclosedEmptyCells(document,point,placementModels)})
  }
  await fs.writeFile(path.join(out,'web-placement.json'),JSON.stringify({nearest,fills},null,2)+'\n')
  const {createRotationMotion}=await server.ssrLoadModule('/src/features/maps/rendering/rotationMotion.js')
  const motionScenarios=[
 {name:'group-pivot',from:{x:2.5,y:3.5,elevation:0,rotation:0},to:{x:4.5,y:3.5,elevation:0,rotation:90}},
 {name:'short-turn',from:{x:2.5,y:3.5,elevation:0,rotation:270},to:{x:2.5,y:3.5,elevation:0,rotation:0}},
 {name:'mirror',from:{x:2.5,y:3.5,elevation:0,rotation:90},to:{x:3.5,y:3.5,elevation:0,rotation:90,mirrored:true}},
 {name:'mirror-turn',from:{x:2.5,y:3.5,elevation:0,rotation:0},to:{x:3.5,y:4.5,elevation:0,rotation:90,mirrored:true}},
];
const motionResult=motionScenarios.map(row=>{const motion=createRotationMotion();motion.set('tile',row.from);motion.set('tile',row.to);return {...row,frames:[0,35,35,70,70,70].map(delta=>{motion.advance(delta);return {delta,pose:{...motion.pose('tile')}}})}});
  await fs.writeFile(path.join(out,'web-motion.json'),JSON.stringify(motionResult,null,2)+'\n')
  console.log(`Web map fixtures: ${results.length}; fog ${fog.length}; fire ${fire.length}`)
} finally { await server.close() }
