import {
  Box3,
  BoxGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Vector3,
  DoubleSide,
} from "three";
import { shadowPrism } from "./shadowGeometry";
import { tileTransform } from "./tileTransform";
import { hiddenAreaMembers } from "../lib/mapAreas";
export function createShadowProxies(assets) {
  const root = new Group(),
    material = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  material.shadowSide = DoubleSide;
  const geometry = new Map();
  let key = "",
    nodes = [];
  function box(w, h, d, x = 0, y = h / 2, z = 0) {
    const g = new BoxGeometry(w, Math.max(0.03, h), d);
    g.translate(x, y, z);
    return g;
  }
  function tileGeometry(model) {
    const id = model.id;
    if (geometry.has(id)) return geometry.get(id);
    const [ox, oz] = model.placementOffset || [0, 0],
      mount = model.mountDepth || 0;
    const base = Math.max(0.03, model.surfaceHeight - mount);
    const parts = [
      box(model.width, base, model.height, -ox, mount + base / 2, -oz),
    ];
    const height = model.maxHeight - model.surfaceHeight;
    for (const polygon of model.blockers || []) {
      if (height < 0.05 || polygon.length < 3) continue;
      parts.push(
        shadowPrism(
          polygon,
          model.surfaceHeight,
          model.maxHeight,
          model.width,
          model.height,
          model.placementOffset,
        ),
      );
    }
    if (
      !model.blockers?.length &&
      ["column", "stairs", "frame"].includes(model.tileType) &&
      height > 0.05
    )
      parts.push(
        box(
          model.width * 0.75,
          height,
          model.height * 0.75,
          -ox,
          model.surfaceHeight + height / 2,
          -oz,
        ),
      );
    geometry.set(id, parts);
    return parts;
  }
  function objectGeometry(object) {
    const id = `object:${object.modelId || object.kind}`;
    if (geometry.has(id)) return geometry.get(id);
    const model =
        assets.model(object.modelId, "lod") ||
        assets.model(object.modelId, "render"),
      bounds = new Box3();
    for (const part of model?.parts || []) {
      part.geometry.computeBoundingBox();
      bounds.union(part.geometry.boundingBox.clone().applyMatrix4(part.matrix));
    }
    const size = bounds.isEmpty()
      ? new Vector3(0.65, 0.6, 0.65)
      : bounds.getSize(new Vector3());
    const center = bounds.isEmpty()
      ? new Vector3(0, 0.3, 0)
      : bounds.getCenter(new Vector3());
    const parts = [box(size.x, size.y, size.z, center.x, center.y, center.z)];
    geometry.set(id, parts);
    return parts;
  }
  function update(document, placed, objects, options) {
    const hidden = hiddenAreaMembers(document),
      ignored = new Set(options.previewTile?.tileIds || []);
    const tiles = [
      ...placed.filter((t) => !ignored.has(t.id)),
      ...(options.previewTile?.group || []),
    ]
      .map((t, i) => ({ ...t, id: t.id || `shadow-preview-${i}` }))
      .filter((t) => !hidden.tiles.has(t.id));
    const props = objects.filter((o) => !hidden.objects.has(o.id));
    const next = JSON.stringify([
      tiles.map((t) => [t.id, t.modelId]),
      props.map((o) => [o.id, o.modelId, o.kind]),
    ]);
    if (next !== key) {
      root.clear();
      nodes = [];
      key = next;
      for (const tile of tiles) {
        const model = assets.metadata(tile.modelId);
        if (!model) continue;
        const group = new Group();
        for (const g of tileGeometry(model)) {
          const m = new Mesh(g, material);
          m.castShadow = true;
          group.add(m);
        }
        group.matrixAutoUpdate = false;
        group.userData.tile = tile.id;
        root.add(group);
        nodes.push({ group, tile, model });
      }
      for (const object of props) {
        const group = new Group();
        for (const g of objectGeometry(object)) {
          const m = new Mesh(g, material);
          m.castShadow = true;
          group.add(m);
        }
        group.userData.object = object.id;
        root.add(group);
        nodes.push({ group, object });
      }
    }
    const byId = new Map(tiles.map((t) => [t.id, t])),
      byObject = new Map(props.map((o) => [o.id, o]));
    for (const node of nodes) {
      if (node.tile) node.tile = byId.get(node.tile.id);
      else node.object = byObject.get(node.object.id);
    }
    return next;
  }
  function advance(tileMatrix, objects) {
    let changed = false;
    const objectRoots = new Map(
      objects.children.map((o) => [o.userData.objectId, o]),
    );
    for (const node of nodes) {
      let matrix;
      if (node.tile)
        matrix =
          tileMatrix(node.tile.id) || tileTransform(node.tile, node.model);
      else {
        const visual = objectRoots.get(node.object.id);
        if (visual) {
          visual.updateMatrix();
          matrix = visual.matrix;
        } else {
          const o = node.object;
          matrix = new Matrix4().makeRotationY((-o.rotation * Math.PI) / 180);
          matrix.scale(new Vector3(o.scale, o.scale, o.scale));
          matrix.setPosition(o.x, o.elevation || 0, o.y);
        }
      }
      if (!node.group.matrix.equals(matrix)) {
        node.group.matrix.copy(matrix);
        node.group.matrixAutoUpdate = false;
        changed = true;
      }
    }
    root.updateMatrixWorld(true);
    return changed;
  }
  return {
    root,
    update,
    advance,
    destroy() {
      root.clear();
      geometry.forEach((parts) => parts.forEach((g) => g.dispose()));
      material.dispose();
    },
  };
}
