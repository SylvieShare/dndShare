import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { initializeStructureReferences } from './medieval_source_reference.mjs';
import { structureDomain } from './medieval_structure_domains.mjs';

test('source projection preserves displaced stone while identifying added water', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(),'medieval-reference-'));
  try {
    const base = path.join(directory,'models/collections/test');
    await fs.mkdir(base,{recursive:true});
    function stl(heights) {
      const bytes = Buffer.alloc(84+heights.length*50);
      bytes.writeUInt32LE(heights.length,80);
      heights.forEach((z,t) => [[-5,-5,z],[5,-5,z],[0,5,z]].flat().forEach((v,c) => bytes.writeFloatLE(v,84+t*50+12+c*4)));
      return bytes;
    }
    const inventory = [];
    for (const [code,heights] of [['empty',[0]],['water',[0,2]]]) {
      const bytes = stl(heights), sourcePath = 'collections/test/'+code+'.stl';
      const sourceSHA256 = createHash('sha256').update(bytes).digest('hex');
      await fs.writeFile(path.join(directory,'models',sourcePath),bytes);
      inventory.push({code,sourcePath,sourceSHA256});
    }
    const filename = path.join(base,'inventory.json');
    await fs.writeFile(filename,JSON.stringify(inventory));
    const part = {minMM:[-5,-5,-1],maxMM:[5,5,3],awayFromSource:{code:'empty',sourceSHA256:inventory[0].sourceSHA256,matchMM:.12,
      projectTo:{code:'water',sourceSHA256:inventory[1].sourceSHA256}}};
    assert.throws(() => structureDomain([0,0,2],part),/Uninitialized/);
    await initializeStructureReferences({surfaceParts:[part]},filename);
    assert.equal(structureDomain([0,0,.3],part),false,'Simplification displacement must not turn stone into water');
    assert.equal(structureDomain([0,0,1.7],part),true,'Added water survives projection from a simplified surface');
    assert.equal(structureDomain([0,0,0],part),false);
    assert.equal(structureDomain([9,0,2],part),false);
    await fs.writeFile(path.join(base,'empty.stl'),stl([.5]));
    await assert.rejects(initializeStructureReferences({surfaceParts:[part]},filename),/bytes changed/);
  } finally { await fs.rm(directory,{recursive:true,force:true}); }
});
