import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const root=path.resolve(import.meta.dirname,'../..'), base=path.join(root,'models/collections/prepared');
const require=createRequire('/private/tmp/dndshare-model-tools/package.json');
const {NodeIO}=require('@gltf-transform/core'), {ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const {meshopt,simplify}=require('@gltf-transform/functions');
const {MeshoptEncoder,MeshoptDecoder,MeshoptSimplifier}=require('meshoptimizer');
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
for(const collection of await fs.readdir(base,{withFileTypes:true})) {
 if(!collection.isDirectory())continue;
 for(const model of await fs.readdir(path.join(base,collection.name),{withFileTypes:true})) {
  if(!model.isDirectory())continue;
  const dir=path.join(base,collection.name,model.name);
  const stat=await fs.stat(path.join(dir,'report.json')).catch(()=>null);if(!stat)continue;
  const row=JSON.parse(await fs.readFile(path.join(dir,'report.json'),'utf8'));
  const normalized=await fs.readFile(path.join(dir,'runtime-version'),'utf8').catch(()=>null);
  for(const tier of ['render','lod']) {
   const out=path.join(dir,`${tier}.glb`);
   if(normalized==='2' && await fs.stat(out).catch(()=>null))continue;
   const doc=await io.read(path.join(dir,'model.glb'));
   const cx=(row.min[0]+row.max[0])/70, cz=(row.min[1]+row.max[1])/70;
   for(const scene of doc.getRoot().listScenes()) for(const node of scene.listChildren()) {
     const t=node.getTranslation();node.setTranslation([t[0]-cx,t[1],t[2]+cz]);
   }
   if(tier==='lod')await doc.transform(simplify({simplifier:MeshoptSimplifier,ratio:.25,error:.005}));
   await doc.transform(meshopt({encoder:MeshoptEncoder,level:'medium'}));
   await io.write(out,doc);
  }
  await fs.writeFile(path.join(dir,'runtime-version'),'2');
  console.log('PACKAGED',row.code);
 }
}
