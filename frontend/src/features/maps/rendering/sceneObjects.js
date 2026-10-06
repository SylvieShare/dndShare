import { buildModelObject } from "./modelObject";
import { applyAreaOpacity } from "./areaOpacity";
import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TextureLoader,
} from "three";
import { visibilityAt } from "../lib/mapModel";
import { FLOOR } from "./annotations";

function box(root, w, h, d, x, y, z, material) {
  const mesh = new Mesh(new BoxGeometry(w, h, d), material);
  mesh.receiveShadow = true;
  mesh.position.set(x, y, z);
  root.add(mesh);
  return mesh;
}
export function buildMapProp(object, open, fog, assets, tier) {
  if (object.modelId) return buildModelObject(object, assets, fog, tier);
  const root = new Group(),
    wood = fog.material(
      new MeshStandardMaterial({ color: 0x826343, roughness: 0.9 }),
    ),
    stone = fog.material(
      new MeshStandardMaterial({ color: 0x827b6c, roughness: 0.95 }),
    );
  root.position.set(object.x, object.elevation ?? FLOOR, object.y);
  root.scale.setScalar(object.scale);
  root.rotation.y = (-object.rotation * Math.PI) / 180;
  switch (object.kind) {
    case "door":
    case "double-door":
    case "portcullis": {
      const leaf = new Group();
      root.add(leaf);
      leaf.rotation.y = open ? Math.PI / 2 : 0;
      box(
        leaf,
        object.kind === "double-door" ? 1.8 : 0.9,
        0.9,
        0.12,
        0,
        0.45,
        0,
        object.kind === "portcullis" ? stone : wood,
      );
      break;
    }
    case "barrel":
    case "column": {
      const mesh = new Mesh(
        new CylinderGeometry(
          0.3,
          0.33,
          object.kind === "column" ? 1.2 : 0.65,
          12,
        ),
        object.kind === "column" ? stone : wood,
      );
      mesh.position.y = object.kind === "column" ? 0.6 : 0.325;
      root.add(mesh);
      break;
    }
    case "table":
      box(root, 0.9, 0.1, 0.7, 0, 0.5, 0, wood);
      for (const x of [-0.35, 0.35])
        for (const z of [-0.25, 0.25])
          box(root, 0.09, 0.5, 0.09, x, 0.25, z, wood);
      break;
    case "chest":
      box(root, 0.7, 0.4, 0.45, 0, 0.2, 0, wood);
      box(root, 0.7, 0.08, 0.45, 0, open ? 0.65 : 0.43, open ? -0.23 : 0, wood);
      break;
    case "torch": {
      box(root, 0.08, 0.6, 0.08, 0, 0.3, 0, wood);
      const glow = fog.material(
        new MeshStandardMaterial({
          color: open ? 0x595147 : 0xffc366,
          emissive: open ? 0 : 0xd36622,
          emissiveIntensity: 0.7,
        }),
      );
      box(root, 0.18, 0.2, 0.18, 0, 0.66, 0, glow);
      break;
    }
    case "stairs":
      for (let i = 0; i < 5; i++)
        box(
          root,
          0.85,
          (i + 1) * 0.1,
          0.18,
          0,
          (i + 1) * 0.05,
          -0.4 + i * 0.18,
          stone,
        );
      break;
    case "bridge":
      box(root, 0.85, 0.12, 1.6, 0, 0.06, 0, wood);
      break;
    case "rubble":
      for (let i = 0; i < 4; i++)
        box(
          root,
          0.25,
          0.15 + i * 0.04,
          0.25,
          ((i % 2) - 0.5) * 0.3,
          0.08,
          (Math.floor(i / 2) - 0.5) * 0.3,
          stone,
        );
      break;
    default:
      box(root, 0.65, 0.6, 0.65, 0, 0.3, 0, wood);
  }
  root.userData.objectId = object.id;
  return root;
}
function label(name) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const c = canvas.getContext("2d");
  c.font = "600 36px sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineWidth = 7;
  c.strokeStyle = "#161b23";
  c.strokeText(name.slice(0, 40), 256, 48);
  c.fillStyle = "#ffffff";
  c.fillText(name.slice(0, 40), 256, 48);
  const sprite = new Sprite(
    new SpriteMaterial({ map: new CanvasTexture(canvas), depthTest: false }),
  );
  sprite.scale.set(2.8, 0.525, 1);
  sprite.renderOrder = 12;
  return sprite;
}
export function buildSceneObjects(d, state, options, fog, assets, tier) {
  const root = new Group();
  for (const o of d.objects) {
    const object = buildMapProp(
      o,
      state?.objects?.[o.id] ?? o.open,
      fog,
      assets,
      tier,
    );
    applyAreaOpacity(object, options.areaObjectOpacity?.(o.id) ?? 1);
    root.add(object);
  }
  for (const token of state?.tokens || []) {
    if (
      !options.master &&
      (token.hidden ||
        token.physical ||
        visibilityAt(d, state, token.x, token.y) !== "visible")
    )
      continue;
    const group = new Group();
    group.position.set(token.x, (token.elevation ?? FLOOR) + 0.05, token.y);
    group.userData.tokenId = token.id;
    const material = fog.material(
      new MeshStandardMaterial({
        color: token.color,
        roughness: 0.8,
        transparent: token.hidden,
        opacity: token.hidden ? 0.4 : 1,
      }),
    );
    const disc = new Mesh(
      new CylinderGeometry(token.size * 0.43, token.size * 0.43, 0.08, 32),
      material,
    );
    group.add(disc);
    if (token.imageUrl)
      new TextureLoader().load(
        token.imageUrl,
        (texture) => {
          if (group.userData.dead) {
            texture.dispose();
            return;
          }
          texture.colorSpace = SRGBColorSpace;
          const avatar = new Mesh(
            new CircleGeometry(token.size * 0.36, 32),
            fog.material(new MeshBasicMaterial({ map: texture })),
          );
          avatar.rotation.x = -Math.PI / 2;
          avatar.position.y = 0.045;
          group.add(avatar);
          options.invalidate?.();
        },
        undefined,
        () => {},
      );
    const text = label(token.name);
    text.position.y = 0.25;
    group.add(text);
    if (token.id === options.selectedToken) {
      const marker = new Mesh(
        new CylinderGeometry(token.size * 0.48, token.size * 0.48, 0.025, 32),
        new MeshStandardMaterial({ color: 0xf2d397, roughness: 0.9 }),
      );
      marker.position.y = -0.04;
      group.add(marker);
    }
    root.add(group);
  }
  return root;
}
export function disposeObjects(root) {
  const materials = new Set();
  root.traverse((n) => {
    n.userData.dead = true;
    if (!n.userData.borrowedGeometry) n.geometry?.dispose();
    if (n.material)
      for (const material of Array.isArray(n.material)
        ? n.material
        : [n.material])
        materials.add(material);
  });
  materials.forEach((m) => {
    if (!m.userData.borrowedTextures) m.map?.dispose();
    m.dispose();
  });
}
