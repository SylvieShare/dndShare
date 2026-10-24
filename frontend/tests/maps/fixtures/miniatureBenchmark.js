import { BoxGeometry, Mesh, MeshStandardMaterial, Scene } from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { newMap, initialState } from "../../../src/features/maps/lib/mapModel";
import { assignTokenBases } from "../../../src/features/maps/lib/tokenBases";
import { createMapRenderer } from "../../../src/features/maps/rendering/mapRenderer";

const payload = await (await fetch("/__miniatures/pilot.json")).json();
const floorId = "22222222-2222-4222-8222-222222222222";
const geometry = new Scene();
const floor = new Mesh(
  new BoxGeometry(1, 0.1, 1),
  new MeshStandardMaterial({ color: 0x777066, roughness: 0.9 }),
);
floor.position.y = -0.05;
geometry.add(floor);
const glb = await new GLTFExporter().parseAsync(geometry, { binary: true });
const floorUrl = "/__miniatures/floor.glb";
await fetch(floorUrl, { method: "PUT", body: glb });
const catalogue = [
  ...payload.models,
  ...payload.bases,
  {
    id: floorId,
    definitionId: "BENCH-FLOOR",
    sourceCode: "BENCH-FLOOR",
    name: "Пол",
    tileType: "floor",
    category: "floor",
    width: 1,
    height: 1,
    maxHeight: 0,
    mountDepth: 0,
    surfaceHeight: 0,
    canStand: true,
    placementPoints: [],
    renderUrl: floorUrl,
    lodUrl: floorUrl,
    shadowUrl: floorUrl,
  },
];
const document = newMap().document;
Object.assign(document, { width: 18, height: 11, grid: { visible: true } });
for (let y = 0; y < document.height; y++)
  for (let x = 0; x < document.width; x++)
    document.tiles.push({
      id: `floor-${x}-${y}`,
      modelId: floorId,
      x,
      y,
      rotation: 0,
      level: 0,
    });
const state = { ...initialState(), fog: false, useCreatureBases: true };
for (let row = 0; row < 5; row++)
  payload.models.forEach((model, column) => {
    state.tokens.push({
      id: `mini-${row}-${column}`,
      kind: "creature",
      itemId: model.itemIds[0],
      name: model.name,
      ref: model.sourceCode,
      size: model.nominalSize,
      x: 1.5 + column * 2.1,
      y: 1.2 + row * 2.1,
      rotation: row * 36,
      color: "#c18f6f",
      hidden: false,
      physical: false,
    });
  });
assignTokenBases(state, catalogue, () => 0);
window.benchmark = { errors: [], state, document, payload };
const renderer = await createMapRenderer(
  window.document.getElementById("map"),
  (error) => window.benchmark.errors.push(error.message),
  undefined,
  (progress) => (window.benchmark.progress = progress),
);
let options = { catalogue, animate: false, master: true, forceLod: false };
await renderer.update(document, state, options);
renderer.camera({
  x: 9,
  y: 5.5,
  cellPixels: 90,
  fit: false,
  azimuth: 0,
  tilt: 55,
});
const stop = renderer.observePerformance(
  (sample) => (window.benchmark.sample = sample),
);
window.benchmark.phase = async (forceLod, shadows) => {
  options = { ...options, forceLod };
  document.lightingEnabled = shadows;
  await renderer.update(document, state, options);
  renderer.camera({ cellPixels: 90, azimuth: 0, fit: false });
};
window.benchmark.rotate = (angle) =>
  renderer.camera({ azimuth: angle, fit: false });
window.benchmark.close = () => {
  stop();
  renderer.destroy();
};
window.benchmark.ready = true;
