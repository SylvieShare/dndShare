// Compare physical sculpt surfaces in native STL millimetres.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const matchers = new WeakMap();

export function awayFromSource(p, reference) {
  const matcher = matchers.get(reference);
  if (!matcher) throw new Error('Uninitialized measured source reference');
  return matcher(p);
}

export async function initializeStructureReferences(settings, inventoryPath) {
  const references = [];
  function visit(part) {
    if (part.awayFromSource) references.push(part.awayFromSource);
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
  async function load(code, hash) {
    const row = inventory.find(row => row.code===code);
    if (!row || row.sourceSHA256!==hash) throw new Error('Source reference identity changed');
    if (trees.has(code)) return trees.get(code);
    const bytes = await fs.readFile(path.join(models,row.sourcePath));
    if (createHash('sha256').update(bytes).digest('hex')!==hash) throw new Error('Source reference bytes changed');
    const count = bytes.readUInt32LE(80);
    if (bytes.length!==84+count*50) throw new Error('Binary STL reference required');
    const positions = new Float32Array(count*9);
    for (let t=0;t<count;t++) for (let c=0;c<9;c++) positions[t*9+c]=bytes.readFloatLE(84+t*50+12+c*4);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position',new BufferAttribute(positions,3));
    const tree = new MeshBVH(geometry);
    trees.set(code,tree);
    return tree;
  }
  for (const reference of references) {
    const tree = await load(reference.code,reference.sourceSHA256);
    const sculpt = reference.projectTo ? await load(reference.projectTo.code,reference.projectTo.sourceSHA256) : null;
    const point = new Vector3(), projected = {}, nearest = {};
    matchers.set(reference,p => {
      point.fromArray(p);
      if (sculpt) {
        const hit = sculpt.closestPointToPoint(point,projected);
        if (!hit) throw new Error('Missing source projection');
        point.copy(hit.point);
      }
      const hit = tree.closestPointToPoint(point,nearest,0,reference.matchMM);
      // A BVH leaf intersecting the threshold can contain farther triangles.
      return hit===null || hit.distance>reference.matchMM;
    });
  }
}
