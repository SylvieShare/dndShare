import { BufferAttribute, BufferGeometry } from "three";
import { MeshBVH } from "three-mesh-bvh";

self.onmessage = ({ data }) => {
  try {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(data.position, 3));
    if (data.index) geometry.setIndex(new BufferAttribute(data.index, 1));
    geometry.groups = data.groups;
    const tree = new MeshBVH(geometry, { indirect: true, range: data.range });
    const serialized = MeshBVH.serialize(tree, { copyIndexBuffer: false });
    const buffers = [
      ...serialized.roots,
      serialized.index?.buffer,
      serialized.indirectBuffer?.buffer,
    ].filter(Boolean);
    self.postMessage({ serialized }, [...new Set(buffers)]);
  } catch (cause) {
    self.postMessage({ error: cause.message });
  }
};
