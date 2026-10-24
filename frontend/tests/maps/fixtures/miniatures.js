import {
  BoxGeometry,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Scene,
} from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
export const MINI_ID = "16351635-1635-4635-8635-163516351635";
export async function miniatureFixture(catalogue, params) {
  if (!params.has("miniatures")) return null;
  const scene = new Scene();
  const mesh = new Mesh(
    new BoxGeometry(0.28, 0.8, 0.28),
    new MeshStandardMaterial({ color: 0x00d8ff }),
  );
  mesh.position.y = 0.4;
  scene.add(mesh);
  // Shared small stones reproduce native GLB nodes with non-baked transforms.
  const stone = new IcosahedronGeometry(1, 0),
    paint = new MeshStandardMaterial({ color: 0x666666 });
  for (const x of [-0.35, 0.35]) {
    const pebble = new Mesh(stone, paint);
    pebble.position.set(x, 0.068, -0.035);
    pebble.scale.set(0.041, 0.013, 0.028);
    scene.add(pebble);
  }
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
  catalogue.push({
    ...catalogue[0],
    id: MINI_ID,
    definitionId: "TEST-MINIATURE",
    sourceCode: "TEST-MINIATURE",
    name: "Миниатюра",
    tileType: "object",
    category: "object",
    width: 1,
    height: 1,
    maxHeight: 0.8,
    mountDepth: 0,
    surfaceHeight: 0,
    hidden: true,
    canStand: false,
    placementPoints: [],
    itemIds: [1635],
    renderUrl: `/api/maps/models/${MINI_ID}/render`,
    lodUrl: `/api/maps/models/${MINI_ID}/lod`,
    shadowUrl: `/api/maps/models/${MINI_ID}/shadow`,
  });
  return {
    id: MINI_ID,
    glb,
    legacy(board) {
      if (params.has("miniatureLegacy"))
        board.state.tokens.push({
          id: "old-ogre",
          kind: "creature",
          ref: "ogre",
          name: "Огр",
          color: "#c18f6f",
          size: 1,
          x: 4.5,
          y: 4.5,
          hidden: false,
          physical: false,
        });
    },
  };
}
