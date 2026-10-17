// Correct measured placement metadata while preserving all five published assets.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile),code=process.argv[2];
assert.match(code||'',/^MT1-\d{3}$/);
const root=path.resolve(import.meta.dirname,'../..'),base=path.join(root,'models/collections/medieval-town-vol1');
const recipePath=path.join(root,'scripts/maps/medieval-recipes',code+'.json');
const recipe=JSON.parse(await fs.readFile(recipePath,'utf8'));
assert.ok(recipe.standPointsMM?.length,'An explicit independently measured native point is required');
const {stdout}=await run('python3',['-c',
  'import sys,json;sys.path.insert(0,sys.argv[1]);from medieval_placement import placement_samples,model_blockers;r=json.load(open(sys.argv[2]));print(json.dumps({"samples":placement_samples(r),"blockers":model_blockers(r)}))',
  import.meta.dirname,recipePath]);
const placement=JSON.parse(stdout);
const row=JSON.parse(await fs.readFile(path.join(base,'inventory.json'),'utf8')).find(r=>r.code===code);
const before=JSON.parse(await fs.readFile(path.join(base,'registry-before-'+code+'-placement.json'),'utf8'));
const directory=path.join(base,'review',code),report=JSON.parse(await fs.readFile(path.join(directory,'report.json'),'utf8'));
const old=before.find(m=>m.id===report.model.id);assert.ok(old);assert.deepEqual(old.assets,report.model.assets);
for(const [kind,asset] of Object.entries(old.assets)) {
  const filename=kind==='source'?path.join(root,'models',row.sourcePath):path.join(directory,kind+(kind==='preview'?'.webp':'.glb'));
  const bytes=await fs.readFile(filename);assert.equal(bytes.length,asset.size);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,'Published resource changed: '+kind);
}
const req=createRequire('/private/tmp/dndshare-model-tools/package.json');
const {NodeIO}=req('@gltf-transform/core'),{ALL_EXTENSIONS}=req('@gltf-transform/extensions'),{MeshoptDecoder}=req('meshoptimizer');
const {BufferGeometry,BufferAttribute,Ray,Vector3,DoubleSide}=req('three'),{MeshBVH}=req('three-mesh-bvh');
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
function tree(vertices){const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(vertices),3));return new MeshBVH(g);}
const sourceBytes=await fs.readFile(path.join(root,'models',row.sourcePath));
assert.equal(createHash('sha256').update(sourceBytes).digest('hex'),row.sourceSHA256);
const count=sourceBytes.readUInt32LE(80),vertices=new Float32Array(count*9);
for(let t=0;t<count;t++)for(let c=0;c<9;c++)vertices[t*9+c]=sourceBytes.readFloatLE(84+t*50+12+c*4);
const sourceTree=tree(vertices);
async function glbTree(filename) {
  const doc=await io.read(filename),v=[];
  for(const node of doc.getRoot().listNodes())if(node.getMesh())for(const primitive of node.getMesh().listPrimitives()) {
    const m=node.getWorldMatrix(),p=primitive.getAttribute('POSITION'),indices=primitive.getIndices();
    for(let i=0;i<indices.getCount();i++) {
      const a=p.getElement(indices.getScalar(i),[]),w=[0,1,2].map(k=>m[k]*a[0]+m[k+4]*a[1]+m[k+8]*a[2]+m[k+12]);
      v.push(w[0]*35+recipe.mountCenterMM[0],-w[2]*35+recipe.mountCenterMM[1],w[1]*35);
    }
  }
  return tree(v);
}
function probe(mesh) {
  return placement.samples.map(([x,y,nx,ny])=>{
    const hit=mesh.raycastFirst(new Ray(new Vector3(nx,ny,recipe.standRayTopMM||1200),new Vector3(0,0,-1)),DoubleSide);
    assert.ok(hit&&hit.face.normal.z>=.5&&hit.point.z>recipe.mountDepthMM+.1,'Invalid measured stand surface');
    return {x,y,nativeMM:[nx,ny],heightMM:hit.point.z,normalZ:hit.face.normal.z};
  });
}
const source=probe(sourceTree),changedKeys=new Set(['placementPoints','surfaceHeight','blockers']);
const stripModel=m=>Object.fromEntries(Object.entries(m).filter(([k])=>!changedKeys.has(k)));
const recipePlacement=new Set(['standPoints','standPointsMM','blockers','blockersMM','reviewNotes']);
const stripRecipe=r=>Object.fromEntries(Object.entries(r).filter(([k])=>!recipePlacement.has(k)));
async function updateReport(filename,renderTree,lodTree,isPublished=false) {
  const r=JSON.parse(await fs.readFile(filename,'utf8'));assert.deepEqual(stripRecipe(r.recipe),stripRecipe(recipe),'Correction changed non-placement recipe');
  const render=probe(renderTree),lod=probe(lodTree);
  for(let i=0;i<source.length;i++)for(const result of [render,lod])assert.ok(Math.abs(result[i].heightMM-source[i].heightMM)<=recipe.standToleranceMM);
  r.recipe=recipe;r.model.placementPoints=render.map(p=>({x:p.x,y:p.y,elevation:Number((p.heightMM/35).toFixed(6))}));
  r.model.surfaceHeight=Math.max(...r.model.placementPoints.map(p=>p.elevation));r.model.blockers=placement.blockers;
  r.standDeviationsMM=render.map((p,i)=>Math.abs(p.heightMM-source[i].heightMM));
  r.lodStandDeviationsMM=lod.map((p,i)=>Math.abs(p.heightMM-source[i].heightMM));
  r.placementCorrection={source,render,lod,unchangedAssets:true,reason:'Native +Y is editor north; move from the south counter to the intended northeast floor and block the actual southern arm.'};
  r.publication=null;
  if(isPublished){assert.deepEqual(stripModel(r.model),stripModel(old),'Correction changed UUID, resources or unrelated metadata');}
  await fs.writeFile(filename,JSON.stringify(r,null,2)+'\n');return r;
}
const render=await glbTree(path.join(directory,'render.glb')),lod=await glbTree(path.join(directory,'lod.glb'));
const updated=await updateReport(path.join(directory,'report.json'),render,lod,true);
const compact=path.join(directory,'candidates/compact');
if(await fs.stat(path.join(compact,'report.json')).catch(()=>null))await updateReport(path.join(compact,'report.json'),await glbTree(path.join(compact,'render.glb')),await glbTree(path.join(compact,'lod.glb')));
for(const tier of ['render','lod']) {
  const file=path.join(base,'prepared',code,tier,'report.json'),r=JSON.parse(await fs.readFile(file,'utf8'));
  assert.deepEqual(stripRecipe(r.recipe),stripRecipe(recipe));const p=probe(await glbTree(path.join(base,'prepared',code,tier,'model.glb')));
  r.recipe=recipe;r.model.placementPoints=p.map(v=>({x:v.x,y:v.y,elevation:Number((v.heightMM/35).toFixed(6))}));
  r.model.surfaceHeight=Math.max(...r.model.placementPoints.map(v=>v.elevation));r.model.blockers=placement.blockers;
  r.standDeviationsMM=p.map((v,i)=>Math.abs(v.heightMM-source[i].heightMM));
  await fs.writeFile(file,JSON.stringify(r,null,2)+'\n');
}
await fs.writeFile(path.join(base,'upload',code,'catalogue.json'),JSON.stringify([updated.model],null,2)+'\n');
console.log('MEDIEVAL_PLACEMENT_CORRECTED',code,updated.model.placementPoints,updated.model.blockers,'five asset hashes unchanged');
