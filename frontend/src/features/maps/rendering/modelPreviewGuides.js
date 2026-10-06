import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";
import {
  GEOMETRY_FIELDS,
  geometryValue,
  previewGeometry,
  previewPorts,
  previewSockets,
} from "../lib/modelPreviewGeometry";

function clear(root) {
  const geometries = new Set(),
    materials = new Set();
  root.traverse((n) => {
    if (n.geometry) geometries.add(n.geometry);
    if (n.material) materials.add(n.material);
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  root.clear();
}
function line(points, color, opacity = 1) {
  const geometry = new BufferGeometry().setAttribute(
    "position",
    new Float32BufferAttribute(points.flat(), 3),
  );
  return new LineSegments(
    geometry,
    new LineBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthTest: true,
    }),
  );
}
function rectangle(x, z, width, height, y) {
  const corners = [
    [x, y, z],
    [x + width, y, z],
    [x + width, y, z + height],
    [x, y, z + height],
  ];
  return corners.flatMap((p, i) => [p, corners[(i + 1) % 4]]);
}
export function modelPreviewGuides() {
  const root = new Group();
  let descriptors = { labels: [], ports: [], sockets: [] };
  function update(model, bounds, { activeField, selectedSlot }) {
    clear(root);
    const g = previewGeometry(model),
      labels = [];
    for (let x = 0; x <= g.width; x++)
      root.add(
        line(
          [
            [x, 0, 0],
            [x, 0, g.height],
          ],
          0x66707d,
          0.45,
        ),
      );
    for (let z = 0; z <= g.height; z++)
      root.add(
        line(
          [
            [0, 0, z],
            [g.width, 0, z],
          ],
          0x66707d,
          0.45,
        ),
      );
    root.add(line(rectangle(0, 0, g.width, g.height, 0), 0xa9bacd));
    GEOMETRY_FIELDS.forEach((field, i) => {
      const active = !activeField || activeField === field.key,
        opacity = active ? 1 : 0.3;
      let a, b;
      if (i < 3) {
        const high = [0, g.surface, g.top][i],
          x = g.width + 0.22 + i * 0.24;
        a = [x, g.bottom, g.height / 2];
        b = [x, high, g.height / 2];
        root.add(
          line(
            rectangle(0, 0, g.width, g.height, i === 0 ? g.bottom : high),
            field.color,
            active ? 0.8 : 0.2,
          ),
        );
        root.add(
          line(
            [
              [x - 0.08, a[1], a[2]],
              [x + 0.08, a[1], a[2]],
              [x - 0.08, b[1], b[2]],
              [x + 0.08, b[1], b[2]],
            ],
            field.color,
            opacity,
          ),
        );
      } else {
        a = [g.width / 2, 0, g.height + 0.28 + (i - 3) * 0.25];
        b = [...a];
        b[i === 3 ? 0 : 2] += g.offset[i - 3];
        const centre = [g.width / 2, 0.012, g.height / 2];
        root.add(
          line(
            [centre, [centre[0] + g.offset[0], 0.012, centre[2] + g.offset[1]]],
            field.color,
            opacity,
          ),
        );
      }
      root.add(line([a, b], field.color, opacity));
      labels.push({
        ...field,
        value: geometryValue(model, field.key),
        position: a.map((n, axis) => (n + b[axis]) / 2),
      });
    });
    const ports = previewPorts(model, bounds.max.y),
      sockets = previewSockets(model);
    if (ports.length)
      root.add(
        line(
          rectangle(0, 0, g.width, g.height, ports[0].position[1]),
          0xb7a3e4,
          0.65,
        ),
      );
    const sphere = new SphereGeometry(
      0.1 + Math.min(g.width, g.height) * 0.007,
      16,
      12,
    );
    const materials = {
      on: new MeshStandardMaterial({ color: 0xb59bf5, roughness: 0.35 }),
      off: new MeshStandardMaterial({ color: 0x626d7a, roughness: 0.7 }),
      socket: new MeshStandardMaterial({ color: 0x66d3a0, roughness: 0.35 }),
      selected: new MeshStandardMaterial({ color: 0xd9b3ff, roughness: 0.3 }),
      invalid: new MeshStandardMaterial({ color: 0xec7777, roughness: 0.35 }),
    };
    ports.forEach((p) => {
      const edge = model.wallMode === "edge",
        geometry = edge
          ? new BoxGeometry(
              p.x ? 0.14 : Math.max(0.3, g.width - 0.16),
              0.2,
              p.y ? 0.14 : Math.max(0.3, g.height - 0.16),
            )
          : sphere;
      const mesh = new Mesh(geometry, p.active ? materials.on : materials.off);
      mesh.position.set(...p.position);
      mesh.userData = { port: p.index };
      root.add(mesh);
    });
    sockets.forEach((p) => {
      const mesh = new Mesh(
        sphere,
        !p.valid
          ? materials.invalid
          : p.index === selectedSlot
            ? materials.selected
            : materials.socket,
      );
      mesh.position.set(...p.position);
      mesh.userData = { slot: p.index };
      root.add(mesh);
    });
    const slot = model.supportSlots[selectedSlot],
      first = sockets.find((p) => p.index === selectedSlot);
    if (slot && first) {
      const size = (n) =>
        Math.max(1, Math.min(8, Number.isFinite(Number(n)) ? Number(n) : 1));
      root.add(
        line(
          rectangle(
            first.position[0] - 0.5,
            first.position[2] - 0.5,
            size(slot.width),
            size(slot.height),
            first.position[1] - 0.01,
          ),
          first.valid ? 0xd9b3ff : 0xec7777,
        ),
      );
    }
    // Unused materials are not attached to the scene graph, so release them now.
    const used = new Set(root.children.map((n) => n.material));
    Object.values(materials).forEach((m) => {
      if (!used.has(m)) m.dispose();
    });
    if (!ports.some(() => model.wallMode !== "edge") && !sockets.length)
      sphere.dispose();
    root.updateMatrixWorld(true);
    descriptors = { labels, ports, sockets };
    return descriptors;
  }
  return {
    root,
    update,
    descriptors: () => descriptors,
    destroy: () => clear(root),
  };
}
