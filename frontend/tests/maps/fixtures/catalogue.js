import { BoxGeometry, Mesh, MeshStandardMaterial, Scene } from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
const WALL = "11111111-1111-4111-8111-111111111111",
  FLOOR = "22222222-2222-4222-8222-222222222222";
const FRAME = "77777777-7777-4777-8777-777777777777",
  BRIDGE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  PEG = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  UD_FLOOR = "88888888-8888-4888-8888-888888888888",
  UD_WALL = "99999999-9999-4999-8999-999999999999";
const catalogue = [
  {
    id: WALL,
    sourceCode: "LC-001",
    sourceName: "Wall 1",
    name: "Стена 1",
    tileType: "wall-straight",
  },
  {
    id: FLOOR,
    sourceCode: "LC-007",
    sourceName: "Ground 1",
    name: "Пол 1",
    tileType: "floor",
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    sourceCode: "TEST-DECOR",
    sourceName: "Ground Bones",
    name: "Пол с декором",
    tileType: "floor",
    hasDecor: true,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    sourceCode: "LC-003",
    sourceName: "Wall Angle",
    name: "Угол стены",
    tileType: "wall-angle",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    sourceCode: "LC-004",
    sourceName: "Wall T-Shaped",
    name: "Т-образная стена",
    tileType: "wall-tee",
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    sourceCode: "LC-005",
    sourceName: "Wall X-Shaped",
    name: "Х-образная стена",
    tileType: "wall-cross",
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    sourceCode: "LC-006",
    sourceName: "Wall Corner",
    name: "Окончание стены",
    tileType: "wall-end",
  },
  {
    id: FRAME,
    sourceCode: "TEST-GRID",
    sourceName: "Grid 2x1",
    name: "Каркас 2×1",
    tileType: "frame",
    wallMode: "none",
    collection: "ultimate-dungeon",
    width: 2,
    height: 1,
    maxHeight: 0.6,
    supportSlots: [{ x: 0, y: 0, width: 2, height: 1, elevation: 0.6 }],
  },
  {
    id: BRIDGE,
    sourceCode: "UD-019",
    sourceName: "Bridge",
    name: "Мост 3×1",
    tileType: "bridge",
    wallMode: "none",
    collection: "ultimate-dungeon",
    width: 3,
    height: 1,
    maxHeight: 0.2,
  },
  {
    id: PEG,
    sourceCode: "TEST-PEG",
    sourceName: "Tile with insertion peg",
    name: "Плитка с выступом",
    tileType: "floor",
    wallMode: "none",
    collection: "ultimate-dungeon",
    mountDepth: 0.2,
    surfaceHeight: 0.4,
    maxHeight: 0.4,
  },
  {
    id: UD_FLOOR,
    sourceCode: "UD-016",
    sourceName: "Ground",
    name: "Каменный пол",
    tileType: "floor",
    wallMode: "edge",
    wallMask: 0,
    collection: "ultimate-dungeon",
  },
  {
    id: UD_WALL,
    sourceCode: "UD-001",
    sourceName: "Wall",
    name: "Боковая стена",
    tileType: "wall-straight",
    wallMode: "edge",
    wallMask: 1,
    collection: "ultimate-dungeon",
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    sourceCode: "UD-096",
    sourceName: "Wall Corner",
    name: "Наружный угол",
    tileType: "wall-corner",
    wallMode: "edge",
    wallMask: 0,
    collection: "ultimate-dungeon",
  },
  {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    sourceCode: "UD-097",
    sourceName: "Wall Diagonal",
    name: "Диагональная стена",
    tileType: "wall-diagonal",
    wallMode: "center",
    wallMask: 0,
    collection: "ultimate-dungeon",
  },
  {
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    sourceCode: "MA-DungeonChest",
    sourceName: "MA_DungeonChest_Full_Prop",
    name: "Сундук",
    tileType: "object",
    wallMode: "none",
    collection: "map-objects",
    canStand: false,
  },
].map((m) => ({
  ...m,
  collection: m.collection || "lost-cave",
  collectionName:
    m.collection === "ultimate-dungeon" ? "Ultimate Dungeon" : "Lost Cave",
  version: 1,
  definitionId: m.sourceCode,
  behaviour: { revision: 1, defaultLights: [], transitions: [] },
  hidden: false,
  hasDecor: !!m.hasDecor,
  canStand:
    m.canStand ?? ["floor", "stairs", "bridge", "passage"].includes(m.tileType),
  placementPoints:
    m.placementPoints ||
    (["floor", "stairs", "bridge", "passage"].includes(m.tileType)
      ? Array.from({ length: (m.width || 1) * (m.height || 1) }, (_, i) => ({
          x: (i % (m.width || 1)) + 0.5,
          y: Math.floor(i / (m.width || 1)) + 0.5,
          elevation: m.surfaceHeight ?? 0.42,
        }))
      : []),
  wallMode: m.wallMode || "center",
  textureDetail: m.textureDetail || "basic",
  supportSlots: m.supportSlots || [],
  width: m.width || 1,
  height: m.height || 1,
  surfaceHeight: m.surfaceHeight ?? 0.42,
  maxHeight: m.maxHeight || 1,
  tags: [],
  blockers: [],
  renderUrl: `/api/maps/models/${m.id}/render`,
  lodUrl: `/api/maps/models/${m.id}/lod`,
  shadowUrl: `/api/maps/models/${m.id}/lod`,
  previewUrl: "/maps/city.svg",
}));
const cubeScene = new Scene(),
  cube = new Mesh(
    new BoxGeometry(0.9, 0.4, 0.9),
    new MeshStandardMaterial({ color: 0x896849, roughness: 0.9 }),
  );
cube.position.y = 0.2;
cubeScene.add(cube);
const glb = await new GLTFExporter().parseAsync(cubeScene, { binary: true });
const frameScene = new Scene();
for (const x of [-0.95, 0, 0.95]) {
  const bar = new Mesh(
    new BoxGeometry(0.1, 0.6, 1),
    new MeshStandardMaterial({ color: 0x747b80 }),
  );
  bar.position.set(x, 0.3, 0);
  frameScene.add(bar);
}
for (const z of [-0.45, 0.45]) {
  const bar = new Mesh(
    new BoxGeometry(2, 0.6, 0.1),
    new MeshStandardMaterial({ color: 0x747b80 }),
  );
  bar.position.set(0, 0.3, z);
  frameScene.add(bar);
}
const frameGlb = await new GLTFExporter().parseAsync(frameScene, {
  binary: true,
});
const bridgeScene = new Scene(),
  bridge = new Mesh(
    new BoxGeometry(2.9, 0.2, 0.9),
    new MeshStandardMaterial({ color: 0x896849 }),
  );
bridge.position.y = 0.1;
bridgeScene.add(bridge);
const bridgeGlb = await new GLTFExporter().parseAsync(bridgeScene, {
  binary: true,
});
const pegScene = new Scene();
for (const [width, height, depth, y, colour] of [
  [0.9, 0.2, 0.9, 0.3, 0x55ccff],
  [0.5, 0.2, 0.5, 0.1, 0xf37bae],
]) {
  const part = new Mesh(
    new BoxGeometry(width, height, depth),
    new MeshStandardMaterial({ color: colour }),
  );
  part.position.y = y;
  pegScene.add(part);
}
const pegGlb = await new GLTFExporter().parseAsync(pegScene, { binary: true });

export {
  WALL,
  FLOOR,
  FRAME,
  BRIDGE,
  PEG,
  UD_FLOOR,
  UD_WALL,
  catalogue,
  glb,
  frameGlb,
  bridgeGlb,
  pegGlb,
};
