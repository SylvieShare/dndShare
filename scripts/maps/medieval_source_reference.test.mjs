import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { initializeStructureReferences, compileSourceReferenceTransform } from "./medieval_source_reference.mjs";
import { structureDomain } from "./medieval_structure_domains.mjs";

test("near-source component references select the sculpt without selecting neighbouring stone", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "medieval-near-component-"),
  );
  try {
    const base = path.join(directory, "models/collections/test");
    await fs.mkdir(base, { recursive: true });
    const triangles = [
      [
        [-1, -1, 2],
        [1, -1, 2],
        [0, 1, 2],
      ],
      [
        [9, -1, 2],
        [11, -1, 2],
        [9, 1, 2],
      ],
      [
        [11, -1, 2],
        [11, 1, 2],
        [9, 1, 2],
      ],
    ];
    const bytes = Buffer.alloc(84 + triangles.length * 50);
    bytes.writeUInt32LE(triangles.length, 80);
    triangles.forEach((t, i) =>
      t
        .flat()
        .forEach((v, c) => bytes.writeFloatLE(v, 84 + i * 50 + 12 + c * 4)),
    );
    const sourceSHA256 = createHash("sha256").update(bytes).digest("hex"),
      sourcePath = "collections/test/source.stl";
    await fs.writeFile(path.join(directory, "models", sourcePath), bytes);
    const inventory = path.join(base, "inventory.json");
    await fs.writeFile(
      inventory,
      JSON.stringify([{ code: "source", sourcePath, sourceSHA256 }]),
    );
    const part = {
      minMM: [-2, -2, 0],
      maxMM: [12, 2, 3],
      nearSource: {
        code: "source",
        sourceSHA256,
        matchMM: 0.01,
        componentAboveMM: 1,
        componentIndex: 0,
        componentBoundsMM: { minMM: [-2, -2, 1], maxMM: [2, 2, 3] },
        projectTo: { code: "source", sourceSHA256 },
      },
    };
    await initializeStructureReferences({ surfaceParts: [part] }, inventory);
    const sample = [0, 0, 1.97];
    assert.equal(structureDomain(sample, part), true);
    assert.deepEqual(sample, [0, 0, 1.97]);
    assert.equal(structureDomain([10, 0, 2], part), false);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("source projection preserves displaced stone while identifying added water", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "medieval-reference-"),
  );
  try {
    const base = path.join(directory, "models/collections/test");
    await fs.mkdir(base, { recursive: true });
    function stl(heights) {
      const bytes = Buffer.alloc(84 + heights.length * 50);
      bytes.writeUInt32LE(heights.length, 80);
      heights.forEach((z, t) =>
        [
          [-5, -5, z],
          [5, -5, z],
          [0, 5, z],
        ]
          .flat()
          .forEach((v, c) => bytes.writeFloatLE(v, 84 + t * 50 + 12 + c * 4)),
      );
      return bytes;
    }
    const inventory = [];
    for (const [code, heights] of [
      ["empty", [0]],
      ["water", [0, 2]],
    ]) {
      const bytes = stl(heights),
        sourcePath = "collections/test/" + code + ".stl";
      const sourceSHA256 = createHash("sha256").update(bytes).digest("hex");
      await fs.writeFile(path.join(directory, "models", sourcePath), bytes);
      inventory.push({ code, sourcePath, sourceSHA256 });
    }
    const filename = path.join(base, "inventory.json");
    await fs.writeFile(filename, JSON.stringify(inventory));
    const part = {
      minMM: [-5, -5, -1],
      maxMM: [5, 5, 3],
      awayFromSource: {
        code: "empty",
        sourceSHA256: inventory[0].sourceSHA256,
        matchMM: 0.12,
        projectTo: { code: "water", sourceSHA256: inventory[1].sourceSHA256 },
      },
    };
    assert.throws(() => structureDomain([0, 0, 2], part), /Uninitialized/);
    await initializeStructureReferences({ surfaceParts: [part] }, filename);
    assert.equal(
      structureDomain([0, 0, 0.3], part),
      false,
      "Simplification displacement must not turn stone into water",
    );
    assert.equal(
      structureDomain([0, 0, 1.7], part),
      true,
      "Added water survives projection from a simplified surface",
    );
    assert.equal(structureDomain([0, 0, 0], part), false);
    assert.equal(structureDomain([9, 0, 2], part), false);
    await fs.writeFile(path.join(base, "empty.stl"), stl([0.5]));
    await assert.rejects(
      initializeStructureReferences({ surfaceParts: [part] }, filename),
      /bytes changed/,
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("a rotated reference protects the aligned wall and retains added geometry", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "medieval-rotated-reference-"),
  );
  try {
    const base = path.join(directory, "models/collections/test");
    await fs.mkdir(base, { recursive: true });
    const bytes = Buffer.alloc(134);
    bytes.writeUInt32LE(1, 80);
    [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ]
      .flat()
      .forEach((v, c) => bytes.writeFloatLE(v, 96 + c * 4));
    const sourceSHA256 = createHash("sha256").update(bytes).digest("hex");
    await fs.writeFile(path.join(base, "wall.stl"), bytes);
    const inventory = path.join(base, "inventory.json");
    await fs.writeFile(
      inventory,
      JSON.stringify([
        { code: "wall", sourceSHA256, sourcePath: "collections/test/wall.stl" },
      ]),
    );
    const part = {
      minMM: [-2, -2, -1],
      maxMM: [2, 2, 1],
      awayFromSource: {
        code: "wall",
        sourceSHA256,
        rotationZDeg: 90,
        matchMM: 0.05,
      },
    };
    await initializeStructureReferences({ woodParts: [part] }, inventory);
    assert.equal(
      structureDomain([-0.2, 0.2, 0], part),
      false,
      "The rotated original must remain protected",
    );
    assert.equal(
      structureDomain([0.2, 0.2, 0], part),
      true,
      "The inverse query must not protect unrotated geometry",
    );
    assert.equal(
      structureDomain([-0.2, 0.2, 0.2], part),
      true,
      "Actual additions beyond the tolerance remain paintable",
    );
    const invalid = {
      ...part,
      awayFromSource: { ...part.awayFromSource, rotationZDeg: Infinity },
    };
    await assert.rejects(
      initializeStructureReferences({ woodParts: [invalid] }, inventory),
      /Finite source rotation/,
    );
    const reflected = {
      ...part,
      awayFromSource: {
        ...part.awayFromSource,
        rotationZDeg: 0,
        mirrorY: true,
      },
    };
    await initializeStructureReferences({ woodParts: [reflected] }, inventory);
    assert.equal(structureDomain([0.2, -0.2, 0], reflected), false);
    assert.equal(structureDomain([0.2, 0.2, 0], reflected), true);
    const composed = {
      ...part,
      awayFromSource: { ...part.awayFromSource, mirrorY: true },
    };
    await initializeStructureReferences({ woodParts: [composed] }, inventory);
    assert.equal(
      structureDomain([0.2, 0.2, 0], composed),
      false,
      "Undo rotation before undoing the source reflection",
    );
    assert.equal(structureDomain([-0.2, 0.2, 0], composed), true);
    await assert.rejects(
      initializeStructureReferences(
        {
          woodParts: [
            {
              ...reflected,
              awayFromSource: { ...reflected.awayFromSource, mirrorY: "yes" },
            },
          ],
        },
        inventory,
      ),
      /Boolean source mirror/,
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('measured source coordinates apply an orthogonal reflection and translation',()=>{
  const transform=compileSourceReferenceTransform({nativeToReferenceMatrix:[[0,-1,0],[-1,0,0],[0,0,1]],nativeToReferenceOffsetMM:[1,2,-.5]});
  assert.deepEqual(transform([15,-7,3]),[8,-13,2.5]);
  const point=[15,-7,3];assert.equal(transform(point,point),point);assert.deepEqual(point,[8,-13,2.5]);
});

test('legacy source rotation and reflection preserve their order',()=>{
  const actual=compileSourceReferenceTransform({rotationZDeg:90,mirrorY:true})([3,5,7]);
  [5,3,7].forEach((v,i)=>assert.ok(Math.abs(actual[i]-v)<1e-12));
  assert.deepEqual(compileSourceReferenceTransform({})([3,5,7]),[3,5,7]);
});

test('source transforms reject scale, missing offsets and mixed coordinate conventions',()=>{
  const ref={nativeToReferenceMatrix:[[1,0,0],[0,1,0],[0,0,1]],nativeToReferenceOffsetMM:[0,0,0]};
  for(const bad of[{nativeToReferenceMatrix:[[2,0,0],[0,1,0],[0,0,1]]},{nativeToReferenceOffsetMM:null},{rotationZDeg:0},{mirrorY:false}])
    assert.throws(()=>compileSourceReferenceTransform({...ref,...bad}),/orthogonal source transform/);
});

test('source projection precedes a measured spatial transform during actual mesh matching',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'medieval-posed-reference-'));
  try {
    const base=path.join(directory,'models/collections/test');await fs.mkdir(base,{recursive:true});
    const triangles={reference:[[0,0,0],[1,0,0],[0,1,0]],posed:[[2,1,.5],[2,0,.5],[1,1,.5]]};
    const rows=[];
    for(const[code,points]of Object.entries(triangles)){
      const bytes=Buffer.alloc(134);bytes.writeUInt32LE(1,80);
      points.flat().forEach((v,i)=>bytes.writeFloatLE(v,96+i*4));
      const sourcePath=`collections/test/${code}.stl`,sourceSHA256=createHash('sha256').update(bytes).digest('hex');
      await fs.writeFile(path.join(directory,'models',sourcePath),bytes);rows.push({code,sourcePath,sourceSHA256});
    }
    const inventory=path.join(base,'inventory.json');await fs.writeFile(inventory,JSON.stringify(rows));
    const part={minMM:[-2,-2,-1],maxMM:[3,3,2],nearSource:{code:'reference',sourceSHA256:rows[0].sourceSHA256,matchMM:.01,
      projectTo:{code:'posed',sourceSHA256:rows[1].sourceSHA256},
      nativeToReferenceMatrix:[[0,-1,0],[-1,0,0],[0,0,1]],nativeToReferenceOffsetMM:[1,2,-.5]}};
    await initializeStructureReferences({surfaceParts:[part]},inventory);
    const sample=[1.8,.8,.7];assert.equal(structureDomain(sample,part),true);
    assert.deepEqual(sample,[1.8,.8,.7]);
    const raw={...part,nearSource:{...part.nearSource,projectTo:undefined}};
    await initializeStructureReferences({surfaceParts:[raw]},inventory);
    assert.equal(structureDomain(sample,raw),false,'The measured projection must remove the simplification offset before matching');
  } finally {await fs.rm(directory,{recursive:true,force:true});}
});
