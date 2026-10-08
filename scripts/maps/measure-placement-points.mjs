// Sample horizontal support surfaces from the actual decoded meshes.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { localModelAsset } from "./local_model_assets.mjs";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const { NodeIO } = require("@gltf-transform/core"), { ALL_EXTENSIONS } = require("@gltf-transform/extensions"), { dequantize } = require("@gltf-transform/functions"), { MeshoptDecoder } = require("meshoptimizer");
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const base = path.resolve(import.meta.dirname, "../../models/collections");
const models = JSON.parse(await fs.readFile(path.join(base, "registry.json"), "utf8"));
const latest = new Map();
for (const m of models) {
  const key = `${m.collection}:${m.sourceCode}:${m.sourceName}`;
  if (!latest.has(key)) latest.set(key, m);
}
const results = [];
function transform(p, m) { return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]]; }
for (const model of latest.values()) {
  if (model.hidden || model.tileType === "object" || /\b(key|support)\b/i.test(model.sourceName)) continue;
  const doc = await io.read(await localModelAsset(model.assets.render));
  await doc.transform(dequantize());
  const triangles = [];
  for (const node of doc.getRoot().listNodes()) {
    const matrix = node.getWorldMatrix();
    for (const primitive of node.getMesh()?.listPrimitives() || []) {
      const pos = primitive.getAttribute("POSITION"), indices = primitive.getIndices();
      for (let i=0; i<(indices?.getCount() || pos.getCount()); i+=3) {
        const vertices = [0,1,2].map((j)=>transform(pos.getElement(indices ? indices.getScalar(i+j) : i+j, []), matrix));
        const [a,b,c]=vertices, ux=b[0]-a[0], uz=b[2]-a[2], vx=c[0]-a[0], vz=c[2]-a[2];
        const det=ux*vz-uz*vx;
        if(Math.abs(det)<1e-8)continue;
        triangles.push({a,b,c,det,minx:Math.min(a[0],b[0],c[0]),maxx:Math.max(a[0],b[0],c[0]),minz:Math.min(a[2],b[2],c[2]),maxz:Math.max(a[2],b[2],c[2])});
      }
    }
  }
  function height(x,z) {
    let top=null;
    for(const t of triangles) {
      if(x<t.minx || x>t.maxx || z<t.minz || z>t.maxz)continue;
      const dx=x-t.a[0], dz=z-t.a[2];
      const u=(dx*(t.c[2]-t.a[2])-dz*(t.c[0]-t.a[0]))/t.det;
      const v=((t.b[0]-t.a[0])*dz-(t.b[2]-t.a[2])*dx)/t.det;
      if(u<0 || v<0 || u+v>1)continue;
      const y=t.a[1]+u*(t.b[1]-t.a[1])+v*(t.c[1]-t.a[1]);
      if(top===null || y>top)top=y;
    }
    return top;
  }
  const points=[];
  for(let y=0;y<model.height;y++)for(let x=0;x<model.width;x++) {
    const samples = model.tileType === "stairs" ? [[.5,.125],[.5,.375],[.5,.625],[.5,.875],[.25,.25],[.75,.75]] : [[.5,.5],[.25,.25],[.75,.25],[.25,.75],[.75,.75]];
    for (const [sx,sy] of samples) {
      const px=x+sx-model.width/2-(model.placementOffset?.[0]||0), pz=y+sy-model.height/2-(model.placementOffset?.[1]||0);
      const elevation=height(px,pz);
      if(elevation===null || elevation<model.mountDepth || elevation>model.maxHeight+.04)continue;
      const around=[[.035,0],[-.035,0],[0,.035],[0,-.035]].map(([dx,dz])=>height(px+dx,pz+dz));
      if(around.some((h)=>h===null || Math.abs(h-elevation)>.05))continue;
      if(model.tileType.startsWith("wall-") && elevation>model.surfaceHeight+.08)continue;
      points.push({x:x+sx,y:y+sy,elevation:Math.round(elevation*1e6)/1e6});
      if(model.tileType!=="stairs")break;
    }
  }
  results.push({collection:model.collection,sourceCode:model.sourceCode,sourceName:model.sourceName,sourceSHA:model.assets.source.sha256,canStand:!!points.length,points});
  console.log("SURFACE_POINTS",model.sourceCode,points.length);
}
await fs.writeFile(path.join(base,"placement-points.json"),JSON.stringify(results,null,2)+"\n");
