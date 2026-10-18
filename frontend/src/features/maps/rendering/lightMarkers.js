import {
  Group,
  Color,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  RingGeometry,
  DoubleSide,
} from "three";
export function createLightMarkers() {
  const root = new Group(),
    sphere = new SphereGeometry(0.1, 12, 8),
    ring = new RingGeometry(0.13, 0.16, 32),
    gray = new Color(0x777777);
  let key = "";
  function clear() {
    root.traverse((n) => n.material?.dispose());
    root.clear();
  }
  function update(lights, options) {
    root.visible = !!options.editLights;
    if (!root.visible) return;
    const next = JSON.stringify([
      lights,
      options.selectedLight,
      options.hoveredLight,
    ]);
    if (key === next) return;
    key = next;
    clear();
    for (const light of lights) {
      if (!light.showMarker && light.id !== options.previewLight?.id) continue;
      const node = new Group(),
        selected =
          light.id === options.selectedLight ||
          light.id === options.previewLight?.id;
      const m = new Mesh(
        sphere,
        new MeshBasicMaterial({
          color: light.enabled ? light.color : "#777777",
          toneMapped: false,
          depthTest: false,
        }),
      );
      m.userData.lightId = light.id;
      m.renderOrder = 15;
      node.add(m);
      if (selected || light.id === options.hoveredLight) {
        const outline = new Mesh(
          ring,
          new MeshBasicMaterial({
            color: light.color,
            toneMapped: false,
            side: DoubleSide,
            depthTest: false,
          }),
        );
        outline.rotation.x = -Math.PI / 2;
        outline.renderOrder = 15;
        node.add(outline);
      }
      node.userData.lightId = light.id;
      node.userData.color = new Color(light.color);
      node.position.set(light.x, light.worldHeight, light.y);
      node.renderOrder = 15;
      root.add(node);
    }
    root.updateMatrixWorld(true);
  }
  return {
    root,
    update,
    applyAppearance(lights, opacity, gain) {
      const entries = new Map(lights.map((l) => [l.id, l]));
      for (const node of root.children) {
        const source = entries.get(node.userData.lightId);
        if (!source) continue;
        const alpha = opacity(source);
        node.visible = alpha > 0.001;
        node.userData.pickable = source.opacity > 0;
        node.children[0].material.color
          .copy(gray)
          .lerp(node.userData.color, gain(source.id));
        for (const mesh of node.children) {
          const m = mesh.material,
            transparent = alpha < 0.999;
          if (transparent !== m.transparent) {
            m.transparent = transparent;
            m.needsUpdate = true;
          }
          m.opacity = alpha;
        }
      }
    },
    move(id, position) {
      const node = root.children.find((n) => n.userData.lightId === id);
      if (node) node.position.copy(position);
    },
    hit(ray) {
      if (!root.visible) return null;
      const h = ray
        .intersectObjects(root.children, true)
        .find(
          (h) =>
            h.object.userData.lightId &&
            h.object.parent.visible &&
            h.object.parent.userData.pickable !== false,
        );
      return h
        ? {
            lightId: h.object.userData.lightId,
            distance: h.distance,
            point: { x: h.point.x, y: h.point.z, elevation: h.point.y },
          }
        : null;
    },
    destroy() {
      clear();
      sphere.dispose();
      ring.dispose();
    },
  };
}
