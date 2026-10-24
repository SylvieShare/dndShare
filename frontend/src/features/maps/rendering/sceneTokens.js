import {
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  RingGeometry,
  Group,
  ImageLoader,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from "three";
import { FLOOR } from "./annotations";
import { buildTokenMiniature } from "./tokenMiniature";
import { deadTokenMark } from "./deadTokenMark";

const portraitKey = (t) =>
  `${t.kind === "player" ? "cover" : "contain"}:${t.imageUrl}`;

// Keep portraits across scene rebuilds and motion; release images no longer on the map.
export function createTokenPortraits(invalidate) {
  const entries = new Map(),
    loader = new ImageLoader();
  function release(key, entry) {
    entry.dead = true;
    entry.texture.dispose();
    entries.delete(key);
  }
  return {
    retain(tokens) {
      const keys = new Set(tokens.filter((t) => t.imageUrl).map(portraitKey));
      for (const [key, entry] of entries)
        if (!keys.has(key)) release(key, entry);
    },
    texture(token) {
      const key = portraitKey(token);
      if (entries.has(key)) return entries.get(key).texture;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      const entry = { texture, dead: false };
      entries.set(key, entry);
      loader.load(
        token.imageUrl,
        (image) => {
          if (entry.dead) return;
          const c = canvas.getContext("2d"),
            width = image.naturalWidth || image.width,
            height = image.naturalHeight || image.height;
          if (!width || !height) return;
          c.fillStyle = "#eee8dc";
          c.fillRect(0, 0, 256, 256);
          const scale =
            token.kind === "player"
              ? Math.max(256 / width, 256 / height)
              : Math.min(236 / width, 236 / height);
          c.drawImage(
            image,
            (256 - width * scale) / 2,
            (256 - height * scale) / 2,
            width * scale,
            height * scale,
          );
          texture.needsUpdate = true;
          invalidate?.();
        },
        undefined,
        () => {},
      );
      return texture;
    },
    destroy() {
      for (const [key, entry] of entries) release(key, entry);
    },
  };
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

export function buildMapToken(token, options, fog) {
  const group = new Group();
  group.position.set(token.x, (token.elevation ?? FLOOR) + 0.05, token.y);
  group.userData.tokenId = token.id;
  const hiddenOpacity = token.hidden ? 0.4 : 1;
  const miniature = token.dead ? null : buildTokenMiniature(token, options, fog);
  if (miniature) {
    const ring = new Mesh(
      new RingGeometry(token.size * 0.45, token.size * 0.49, 48),
      fog.material(
        new MeshStandardMaterial({
          color: token.color,
          roughness: 0.85,
          transparent: !!token.hidden,
          opacity: hiddenOpacity,
        }),
      ),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.039;
    group.add(ring, miniature.root);
    if (miniature.base) group.add(miniature.base);
  } else {
    const disc = new Mesh(
        new CylinderGeometry(token.size * 0.43, token.size * 0.43, token.dead ? 0.015 : 0.08, 32),
        fog.material(
          new MeshStandardMaterial({
            color: token.color,
            roughness: 0.8,
            transparent: !!token.hidden,
            opacity: hiddenOpacity,
          }),
        ),
      );
    if (token.dead) disc.position.y = -.0325;
    group.add(disc);
    if (token.imageUrl && options.tokenPortraits) {
      const material = fog.material(
        new MeshBasicMaterial({
          map: options.tokenPortraits.texture(token),
          transparent: true,
          opacity: hiddenOpacity,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      material.userData.borrowedTextures = true;
      const avatar = new Mesh(
        new CircleGeometry(token.size * 0.39, 48),
        material,
      );
      avatar.rotation.x = -Math.PI / 2;
      avatar.position.y = token.dead ? -.024 : 0.045;
      group.add(avatar);
    }
    if (token.dead) group.add(deadTokenMark(token, fog));
  }
  const text = label(token.name);
  text.position.y = miniature ? miniature.height + 0.2 : 0.25;
  group.add(text);
  if (token.id === options.selectedToken) {
    const marker = new Mesh(
      new CylinderGeometry(
        token.size * (miniature ? 0.52 : 0.48),
        token.size * (miniature ? 0.52 : 0.48),
        0.025,
        32,
      ),
      new MeshStandardMaterial({ color: 0xf2d397, roughness: 0.9 }),
    );
    marker.position.y = -0.04;
    group.add(marker);
  }
  return group;
}
