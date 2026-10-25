// Compare physical sculpt surfaces in native STL millimetres.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { selectSourceComponent } from './source_component_regions.mjs';

const matchers = new WeakMap();

export function compileSourceReferenceTransform(reference) {
  const matrix=reference.nativeToReferenceMatrix,offset=reference.nativeToReferenceOffsetMM;
  const vector=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);
  if (matrix!==undefined||offset!==undefined) {
    if (!Array.isArray(matrix)||matrix.length!==3||!matrix.every(vector)||!vector(offset)||
        reference.rotationZDeg!==undefined||reference.mirrorY!==undefined||
        matrix.some((row,i)=>matrix.some((other,j)=>
          Math.abs(row.reduce((sum,v,a)=>sum+v*other[a],0)-(i===j?1:0))>1e-6)))
      throw new Error('Measured orthogonal source transform required');
    return (p,out=[])=>{
      const x=p[0],y=p[1],z=p[2];
      for(let a=0;a<3;a++)out[a]=matrix[a][0]*x+matrix[a][1]*y+matrix[a][2]*z+offset[a];
      return out;
    };
  }
  const degrees=reference.rotationZDeg??0;
  if (!Number.isFinite(degrees)) throw new Error('Finite source rotation required');
  if (reference.mirrorY!==undefined&&typeof reference.mirrorY!=='boolean')
    throw new Error('Boolean source mirror required');
  const angle=-degrees*Math.PI/180,cosine=Math.cos(angle),sine=Math.sin(angle);
  return(p,out=[])=>{
    const x=p[0],y=p[1],z=p[2];
    out[0]=x*cosine-y*sine;out[1]=(x*sine+y*cosine)*(reference.mirrorY?-1:1);out[2]=z;
    return out;
  };
}

export function awayFromSource(p, reference) {
  const matcher = matchers.get(reference);
  if (!matcher) throw new Error('Uninitialized measured source reference');
  return matcher(p);
}

export async function initializeStructureReferences(settings, inventoryPath) {
  const references = [];
  function visit(part) {
    if (part.awayFromSource) references.push(part.awayFromSource);
    if (part.nearSource) references.push(part.nearSource);
    for (const child of [...(part.includeParts || []), ...(part.excludeParts || [])]) visit(child);
  }
  for (const key of ['woodParts','stoneParts','fabricParts','produceParts','surfaceParts','ironParts'])
    for (const part of settings[key] || []) visit(part);
  if (!references.length) return;
  const require = createRequire('/private/tmp/dndshare-model-tools/package.json');
  const { BufferGeometry, BufferAttribute, Vector3 } = require('three');
  const { MeshBVH } = require('three-mesh-bvh');
  const inventory = JSON.parse(await fs.readFile(inventoryPath,'utf8'));
  const models = path.resolve(path.dirname(inventoryPath),'../..');
  const trees = new Map();
  async function load(code, hash, selection = {}) {
    if (selection.componentBoundsMM !== undefined && selection.componentAboveMM === undefined) throw new Error('Component bounds require a finite sampling height');
    const row = inventory.find(row => row.code===code);
    if (!row || row.sourceSHA256!==hash) throw new Error('Source reference identity changed');
    const key = `${code}:${selection.componentAboveMM ?? 'full'}:${selection.componentIndex ?? 0}:${JSON.stringify(selection.componentBoundsMM ?? null)}`;
    if (trees.has(key)) return trees.get(key);
    const bytes = await fs.readFile(path.join(models,row.sourcePath));
    if (createHash('sha256').update(bytes).digest('hex')!==hash) throw new Error('Source reference bytes changed');
    const count = bytes.readUInt32LE(80);
    if (bytes.length!==84+count*50) throw new Error('Binary STL reference required');
    const positions = new Float32Array(count*9);
    for (let t=0;t<count;t++) for (let c=0;c<9;c++) positions[t*9+c]=bytes.readFloatLE(84+t*50+12+c*4);
    let selected = positions;
    if (selection.componentAboveMM !== undefined) {
      const component = selectSourceComponent(positions, selection.componentAboveMM, selection.componentIndex ?? 0, selection.componentBoundsMM);
      selected = component.positions;
      console.log('MEDIEVAL_SOURCE_COMPONENT', code, component.components, component.vertices, component.triangles);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position',new BufferAttribute(selected,3));
    const tree = new MeshBVH(geometry);
    trees.set(key,tree);
    return tree;
  }
  for (const reference of references) {
    const transform=compileSourceReferenceTransform(reference);
    const tree = await load(reference.code,reference.sourceSHA256,reference);
    const sculpt = reference.projectTo ? await load(reference.projectTo.code,reference.projectTo.sourceSHA256) : null;
    const point = new Vector3(), projected = {}, nearest = {},input=[0,0,0],output=[0,0,0];
    matchers.set(reference,p => {
      point.fromArray(p);
      if (sculpt) {
        const hit = sculpt.closestPointToPoint(point,projected);
        if (!hit) throw new Error('Missing source projection');
        point.copy(hit.point);
      }
      input[0]=point.x;input[1]=point.y;input[2]=point.z;
      transform(input,output);point.fromArray(output);
      const hit = tree.closestPointToPoint(point,nearest,0,reference.matchMM);
      // A BVH leaf intersecting the threshold can contain farther triangles.
      return hit===null || hit.distance>reference.matchMM;
    });
  }
}
