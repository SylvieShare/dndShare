// One measured Medieval Town model, with five validated publication resources.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { currentModel } from './current_model.mjs';
import { prepareShadow } from './shadow_model.mjs';
import { rasterizeSurface, seedSurfaceGutters, extendUvGutters } from './uv_surface.mjs';
import { uvSurfaceTracker } from './uv_surface_overlap.mjs';
import { torchSurface, torchFlameDomain } from './medieval_torch_domains.mjs';
import { structureMetal, structureLiquid, structureFlame, structureFabricPigment, shouldRepairGreenSpill } from './medieval_structure_domains.mjs';
import { initializeStructureReferences } from './medieval_source_reference.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const base = path.join(root, 'models/collections/medieval-town-vol1');
const code = process.argv.find(a => a.startsWith('--code='))?.slice(7);
if (!/^MT1-\d{3}$/.test(code || '')) throw new Error('One source code required');
const recipeIndex = JSON.parse(await fs.readFile(path.join(root, 'scripts/maps/medieval-recipes.json'), 'utf8'));
const recipe = JSON.parse(await fs.readFile(path.join(root, 'scripts/maps', recipeIndex[code]), 'utf8'));
await initializeStructureReferences(recipe.materials,path.join(base,'inventory.json'));
const candidate = process.argv.find(a => a.startsWith('--candidate='))?.slice(12);
if (candidate && candidate!=='compact') throw new Error('Unknown texture candidate');
const review = path.join(base, 'review', code, ...(candidate ? ['candidates', candidate] : []));
const require = createRequire('/private/tmp/dndshare-model-tools/package.json');
const sharp = require('sharp');
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { meshopt, getBounds } = require('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptDecoder } = require('meshoptimizer');
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
});
const previous = JSON.parse(await fs.readFile(path.join(review, 'report.json'), 'utf8').catch(() => '{}'));
await fs.mkdir(review, { recursive: true });
const reports = {};
const tiers = {};
if (!process.argv.includes('--publish-manifest')) {
  for (const tier of ['render', 'lod']) {
    const directory = path.join(base, 'prepared', code, tier);
    const report = reports[tier] = JSON.parse(await fs.readFile(path.join(directory, 'report.json'), 'utf8'));
    if (JSON.stringify(report.recipe)!==JSON.stringify(recipe)) throw new Error('Stale baked recipe; prepare both tiers again');
    const doc = await io.read(path.join(directory, 'model.glb'));
    const size = tier === 'render' ? (candidate ? 768 : 1024) : (candidate ? 384 : 512);
    const bakedCoverage = rasterizeSurface(doc, report.recipe[tier+'BakeSize'], report.recipe[tier+'BakeSize'],
      uvSurfaceTracker(report.recipe[tier+'BakeSize'], report.recipe[tier+'BakeSize']));
    const packedCoverage = rasterizeSurface(doc, size, size, uvSurfaceTracker(size, size));
    if (!bakedCoverage.some(Boolean) || !packedCoverage.some(Boolean)) throw new Error('UV has no physical surface pixels: '+tier);
    const materials = doc.getRoot().listMaterials();
    const normal = new Set(materials.map(m => m.getNormalTexture()));
    const colour = new Set(materials.map(m => m.getBaseColorTexture()));
    const orm = new Set(materials.map(m => m.getMetallicRoughnessTexture()));
    const emissive = new Set(materials.map(m => m.getEmissiveTexture()));
    for (const texture of doc.getRoot().listTextures()) {
      const pixels = colour.has(texture) || emissive.has(texture) ? size : size/2;
      const slot = colour.has(texture) ? 'BaseColor' : normal.has(texture) ? 'Normal' : emissive.has(texture) ? 'Emissive' : 'MetallicRoughness';
      if (!colour.has(texture) && !normal.has(texture) && !orm.has(texture) && !emissive.has(texture)) throw new Error('Unexpected texture');
      const { data, info } = await sharp(Buffer.from(texture.getImage())).resize(pixels, pixels).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      if (normal.has(texture)) {
        for (let i = 0; i < data.length; i += info.channels) {
          const n = [data[i]/127.5-1, data[i+1]/127.5-1, Math.max(.01, data[i+2]/127.5-1)];
          const length = Math.hypot(...n);
          for (let c = 0; c < 3; c++) data[i+c] = Math.round((n[c]/length+1)*127.5);
        }
      }
      let coverage = rasterizeSurface(doc, pixels, pixels, () => {}, slot);
      if (colour.has(texture)) {
        const pigment = (i,p,n,rgba) => {
          if (!rgba) throw new Error('Measured Paint attribute required for colour gutters');
          const liquid = structureLiquid(p, recipe.materials) || structureFlame(p, recipe.materials);
          const fabric = structureFabricPigment(p, recipe.materials);
          if (fabric) rgba = fabric.map(v => v<=.04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
          if (liquid) {
            const variation = 1+(liquid.variation ?? .025)*Math.sin(p[0]*1.73+p[1]*2.31+p[2]*1.17);
            rgba = liquid.rgb.map(c => {
              const v = c*variation;
              return v<=.04045 ? v/12.92 : ((v+.055)/1.055)**2.4;
            });
          }
          for (let c=0;c<3;c++) {
            const v = Math.max(0,Math.min(1,rgba[c]*.9));
            data[i*3+c] = Math.round((v<=.0031308 ? v*12.92 : 1.055*v**(1/2.4)-.055)*255);
          }
        };
        if (recipe.materials.fabricParts?.length || recipe.materials.produceParts?.length || recipe.materials.surfaceParts?.some(p => ['liquid','flame'].includes(p.kind))) {
          rasterizeSurface(doc,pixels,pixels,(i,p,n,rgba) => {
            if (structureLiquid(p,recipe.materials) || structureFlame(p,recipe.materials) || structureFabricPigment(p,recipe.materials) || shouldRepairGreenSpill(data.subarray(i*3,i*3+3),rgba,p,recipe.materials)) pigment(i,p,n,rgba);
          },slot,'COLOR_1');
        }
        coverage = seedSurfaceGutters(doc,pixels,pixels,coverage,pigment,1,slot,'COLOR_1');
      }
      if (orm.has(texture) && (recipe.materials.kind==='structure' || recipe.materials.hardware?.length || recipe.materials.ironParts?.length)) {
        const writeHardware = (i, p, used) => {
          let weight = 0;
          for (const h of recipe.materials.hardware || []) {
            if (p[2]<h.minZMM) continue;
            const d = p.reduce((sum,v,c) => sum+((v-h.centerMM[c])/h.radiiMM[c])**2, 0);
            weight = Math.max(weight, Math.max(0, Math.min(1, (1-d)/.2)));
          }
          if (!used) data[i*3] = 255;
          if (recipe.materials.kind==='structure') {
            const channels = structureMetal(p, recipe.materials);
            data[i*3+1] = Math.round(channels.roughness*255);
            data[i*3+2] = Math.round(channels.metallic*255);
            return;
          }
          if (recipe.materials.kind==='torch') {
            const channels = torchSurface(p, recipe.materials);
            data[i*3+1] = Math.round(channels.roughness*255);
            data[i*3+2] = Math.round(channels.metallic*255);
            return;
          }
          data[i*3+1] = Math.round((.88*(1-weight)+.43*weight)*255);
          data[i*3+2] = Math.round(weight*255);
        };
        coverage = rasterizeSurface(doc, pixels, pixels, (i,p) => writeHardware(i,p,true), slot);
        coverage = seedSurfaceGutters(doc, pixels, pixels, coverage, (i,p) => writeHardware(i,p,false), 1, slot);
      }
      if (emissive.has(texture) && recipe.materials.kind==='torch') {
        coverage = rasterizeSurface(doc, pixels, pixels, (i,p) => {
          if (!torchFlameDomain(p, recipe.materials.torch)) data.fill(0, i*3, i*3+3);
        }, slot);
      }
      if (emissive.has(texture) && recipe.materials.kind==='structure') {
        coverage = rasterizeSurface(doc,pixels,pixels,(i,p) => {
          const flame = structureFlame(p,recipe.materials);
          for (let c=0;c<3;c++) data[i*3+c]=flame ? Math.round(flame.rgb[c]*255) : 0;
        },slot);
        coverage = seedSurfaceGutters(doc,pixels,pixels,coverage,(i,p) => {
          const flame = structureFlame(p,recipe.materials);
          for (let c=0;c<3;c++) data[i*3+c]=flame ? Math.round(flame.rgb[c]*255) : 0;
        },1,slot);
      }
      extendUvGutters(data, info.channels, coverage.slice(), pixels, pixels, 4);
      const pipeline = sharp(data, { raw: info });
      const bytes = await (colour.has(texture) ? pipeline.jpeg({ quality: 94, chromaSubsampling: '4:4:4' }) : pipeline.png()).toBuffer();
      const decoded = await sharp(bytes).removeAlpha().raw().toBuffer();
      for (let i = 0; i < coverage.length; i++) if (coverage[i]) {
        if (colour.has(texture) && Math.max(...decoded.subarray(i*3, i*3+3))<4) throw new Error('Black compressed surface');
        if (normal.has(texture) && decoded[i*3+2]<128) throw new Error('Invalid compressed normal');
      }
      texture.setImage(bytes).setMimeType(colour.has(texture) ? 'image/jpeg' : 'image/png');
    }
    for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
      for (const semantic of p.listSemantics()) if (semantic.startsWith('COLOR_')) p.setAttribute(semantic, null);
    }
    const before = getBounds(doc.getRoot().listScenes()[0]);
    await io.write(path.join(review, tier==='render' ? 'preview-model.glb' : 'lod-preview-model.glb'), doc);
    await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 16,
      ...(['torch','structure'].includes(recipe.materials.kind) ? { quantizeTexcoord: 16 } : {}) }));
    const final = await io.writeBinary(doc);
    await fs.writeFile(path.join(review, tier+'.glb'), final);
    const decoded = await io.readBinary(final);
    const after = getBounds(decoded.getRoot().listScenes()[0]);
    for (const side of ['min', 'max']) for (let i = 0; i < 3; i++) {
      if (Math.abs(before[side][i]-after[side][i])>.0002) throw new Error('Packaging changed bounds');
    }
    tiers[tier] = { bytes: final.length, triangles: report.triangles, colourSize: size, normalORMSize: size/2,
      ...(recipe.materials.torch?.flameReference || recipe.materials.surfaceParts?.some(p => p.kind==='flame') ? { emissiveSize: size, emissiveFormat: 'PNG sRGB' } : {}),
      blackSurfacePixels: 0, invalidNormalPixels: 0, bounds: after, quality: report.quality };
    console.log('MEDIEVAL_PACKAGED', code, tier, tiers[tier].triangles, final.length);
  }
  const shadow = await prepareShadow(path.join(review, 'lod.glb'), path.join(review, 'shadow.glb'));
  tiers.shadow = { bytes: shadow.asset.size, triangles: shadow.triangles, bounds: shadow.bounds };
  const report = { ...reports.render, model: { ...reports.render.model, ...(previous.model?.id ? { id: previous.model.id } : {}) },
    tiers, lodStandDeviationsMM: reports.lod.standDeviationsMM,
    optimization: { candidate: candidate || 'balanced', selection: 'pending visual comparison' },
    publication: previous.publication || null };
  await fs.writeFile(path.join(review, 'report.json'), JSON.stringify(report, null, 2)+'\n');
} else {
  const report = previous;
  if (!report.model || !report.tiers?.shadow) throw new Error('Prepare geometry, textures and shadow first');
  if (JSON.stringify(report.recipe)!==JSON.stringify(recipe)) throw new Error('Stale publication recipe');
  const input = path.join(review, 'preview.png');
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = [];
  for (let i = 3; i < data.length; i += 4) alpha.push(data[i]);
  if (!alpha.some(v => v===0) || !alpha.some(v => v===255)) throw new Error('Preview needs transparent and opaque pixels');
  for (let x = 0; x < info.width; x++) for (const y of [0, info.height-1]) {
    if (data[(y*info.width+x)*4+3]) throw new Error('Preview touches horizontal edge');
  }
  for (let y = 0; y < info.height; y++) for (const x of [0, info.width-1]) {
    if (data[(y*info.width+x)*4+3]) throw new Error('Preview touches vertical edge');
  }
  const preview = await sharp(input).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
  if (!(await sharp(preview).metadata()).hasAlpha) throw new Error('WebP lost alpha');
  await fs.writeFile(path.join(review, 'preview.webp'), preview);
  const upload = path.join(base, 'upload', code);
  await fs.mkdir(upload, { recursive: true });
  const assets = {};
  for (const [kind, file, mime] of [
    ['render', path.join(review, 'render.glb'), 'model/gltf-binary'],
    ['lod', path.join(review, 'lod.glb'), 'model/gltf-binary'],
    ['shadow', path.join(review, 'shadow.glb'), 'model/gltf-binary'],
    ['preview', path.join(review, 'preview.webp'), 'image/webp'],
    ['source', path.join(root, 'models', report.sourcePath), 'model/stl'],
  ]) {
    const bytes = await fs.readFile(file);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const ext = path.extname(file), name = sha256+ext;
    if (bytes.length>(kind==='source' ? 256 : kind==='preview' ? 4 : 32)*1048576) throw new Error('MCP size limit');
    if (kind==='source' && sha256!==report.sourceSHA256) throw new Error('Immutable source changed');
    await fs.writeFile(path.join(upload, name), bytes);
    assets[kind] = { key: 'map-models/'+name, sha256, size: bytes.length, mimeType: mime,
      fileName: kind==='source' ? path.basename(file) : kind+ext };
  }
  const registry = JSON.parse(await fs.readFile(path.join(base, 'registry-snapshot.json'), 'utf8'));
  report.model = currentModel(report.model, registry, assets);
  report.runtimeBytes = [...new Map(Object.entries(assets).filter(([kind]) => kind!=='source')
    .map(([, a]) => [a.sha256, a.size])).values()].reduce((a,b) => a+b, 0);
  await fs.writeFile(path.join(review, 'report.json'), JSON.stringify(report, null, 2)+'\n');
  await fs.writeFile(path.join(upload, 'catalogue.json'), JSON.stringify([report.model], null, 2)+'\n');
  console.log('MEDIEVAL_MANIFEST', code, report.model.id, report.runtimeBytes);
}
