import {
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from "three";
import { decalOrientation, projectedDecalGeometry } from "./decalGeometry";
import { visibleDecalPixel } from "./decalHit";

export function createMapDecals(
  fog,
  changed,
  onError,
  getOwner,
  loader = new TextureLoader(),
) {
  const root = new Group(),
    records = new Map(),
    textures = new Map();
  root.matrixAutoUpdate = false;
  let current = [],
    appearance,
    options = {},
    dead = false;
  function texture(url) {
    if (textures.has(url)) return textures.get(url).texture;
    const record = {};
    record.ready = new Promise((resolve, reject) => {
      record.texture = loader.load(
        url,
        (loaded) => {
          if (dead || textures.get(url) !== record) {
            loaded.dispose();
            resolve();
            return;
          }
          changed();
          resolve();
        },
        undefined,
        () => {
          const error = new Error("Не удалось загрузить изображение декали");
          if (!dead && textures.get(url) === record) onError(error.message);
          reject(error);
        },
      );
      record.texture.colorSpace = SRGBColorSpace;
      record.texture.anisotropy = 4;
    });
    record.ready.catch(() => {});
    textures.set(url, record);
    return record.texture;
  }
  function release(id, record) {
    root.remove(record.root);
    record.root.traverse((node) => {
      node.geometry?.dispose();
    });
    record.material.dispose();
    record.frame.material.dispose();
    records.delete(id);
  }
  function sync() {
    const keep = new Set(),
      used = new Set();
    for (const decal of current) {
      const owner = getOwner(decal.anchor.kind, decal.anchor.id);
      if (!owner?.source || !owner.matrix) continue;
      keep.add(decal.id);
      used.add(decal.imageUrl);
      const shape = JSON.stringify([
        decal.position,
        decal.normal,
        decal.width,
        decal.height,
        decal.depth,
        decal.rotation,
      ]);
      let record = records.get(decal.id);
      if (
        record &&
        (record.source !== owner.source ||
          record.shape !== shape ||
          record.url !== decal.imageUrl)
      ) {
        release(decal.id, record);
        record = null;
      }
      if (!record) {
        const group = new Group();
        group.matrixAutoUpdate = false;
        group.userData.decalId = decal.id;
        const material = fog.material(
          new MeshStandardMaterial({
            map: texture(decal.imageUrl),
            transparent: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2,
            roughness: 0.95,
            metalness: 0,
            alphaTest: 0.01,
          }),
        );
        for (const part of owner.source.parts) {
          const geometry = projectedDecalGeometry(part, decal);
          if (!geometry.attributes.position.count) {
            geometry.dispose();
            continue;
          }
          const mesh = new Mesh(geometry, material);
          mesh.matrixAutoUpdate = false;
          mesh.receiveShadow = true;
          mesh.renderOrder = 2;
          mesh.userData.decalId = decal.id;
          group.add(mesh);
        }
        const orientation = decalOrientation(
          new Vector3(...decal.normal),
          decal.rotation,
        );
        const frameGeometry = new BufferGeometry().setFromPoints(
          [
            [-0.5, -0.5],
            [0.5, -0.5],
            [0.5, 0.5],
            [-0.5, 0.5],
          ].map(([x, y]) =>
            new Vector3(x * decal.width, y * decal.height, 0.004)
              .applyEuler(orientation)
              .add(new Vector3(...decal.position)),
          ),
        );
        const frame = new LineLoop(
          frameGeometry,
          new LineBasicMaterial({
            color: 0xe9b95b,
            depthTest: false,
            transparent: true,
            opacity: 0.85,
          }),
        );
        frame.renderOrder = 3;
        frame.raycast = () => {};
        group.add(frame);
        record = {
          root: group,
          source: owner.source,
          shape,
          url: decal.imageUrl,
          material,
          frame,
        };
        records.set(decal.id, record);
        root.add(group);
      }
      record.decal = decal;
      record.root.matrix.copy(owner.matrix);
      record.material.color.set(decal.color);
      record.frame.visible =
        decal.preview || options.selectedDecal === decal.id;
      record.material.opacity = decal.opacity * opacity(decal);
      record.root.visible =
        owner.visible !== false && record.material.opacity > 0.001;
    }
    for (const [id, record] of records) if (!keep.has(id)) release(id, record);
    for (const [url, record] of textures)
      if (!used.has(url)) {
        record.texture.dispose();
        textures.delete(url);
      }
    root.updateMatrixWorld(true);
  }
  function opacity(decal) {
    if (!appearance) return 1;
    return decal.anchor.kind === "tile"
      ? appearance.tokenOpacity(decal.anchor.id)
      : appearance.objectOpacity(decal.anchor.id);
  }
  return {
    root,
    update(document, nextAppearance, nextOptions) {
      appearance = nextAppearance;
      options = nextOptions;
      current = [
        ...(document.decals || []).filter(
          (d) =>
            !nextOptions.previewDecal?.moving ||
            d.id !== nextOptions.previewDecal.id,
        ),
        ...(nextOptions.previewDecal ? [nextOptions.previewDecal] : []),
      ];
      sync();
    },
    selection(nextOptions) {
      options = { ...options, selectedDecal: nextOptions.selectedDecal };
      for (const record of records.values())
        record.frame.visible =
          record.decal.preview || options.selectedDecal === record.decal.id;
    },
    advance() {
      for (const record of records.values()) {
        const owner = getOwner(
          record.decal.anchor.kind,
          record.decal.anchor.id,
        );
        if (owner?.matrix) record.root.matrix.copy(owner.matrix);
        record.material.opacity = record.decal.opacity * opacity(record.decal);
        record.root.visible =
          !!owner && owner.visible !== false && record.material.opacity > 0.001;
      }
      root.updateMatrixWorld(true);
    },
    async ready() {
      await Promise.all([...textures.values()].map((record) => record.ready));
    },
    pick(ray) {
      const hit = ray
        .intersectObject(root, true)
        .find(
          (h) =>
            h.object.parent.visible &&
            h.object.material.opacity > 0.05 &&
            visibleDecalPixel(h),
        );
      return hit
        ? {
            decalId: hit.object.userData.decalId,
            distance: hit.distance,
            point: { x: hit.point.x, y: hit.point.z, elevation: hit.point.y },
          }
        : null;
    },
    destroy() {
      dead = true;
      for (const [id, record] of records) release(id, record);
      for (const record of textures.values()) record.texture.dispose();
      textures.clear();
      current = [];
    },
  };
}
