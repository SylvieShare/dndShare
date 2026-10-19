import { BufferAttribute, BufferGeometry, Matrix4, Mesh, Sphere } from "three";
import { acceleratedRaycast, MeshBVH } from "three-mesh-bvh";

const prepared = new WeakMap();
let worker,
  idle,
  queue = Promise.resolve();
async function generate(geometry) {
  clearTimeout(idle);
  worker ||= new Worker(new URL("./modelPicking.worker.js", import.meta.url), {
    type: "module",
  });
  try {
    return await new Promise((resolve, reject) => {
      worker.onmessage = ({ data }) =>
        data.error ? reject(new Error(data.error)) : resolve(data.serialized);
      worker.onerror = (error) => {
        worker.terminate();
        worker = null;
        reject(new Error(error.message));
      };
      const position = geometry.attributes.position.array,
        index = geometry.index?.array;
      worker.postMessage(
        { position, index, groups: geometry.groups, range: geometry.drawRange },
        [position.buffer, ...(index ? [index.buffer] : [])],
      );
    });
  } finally {
    idle = setTimeout(() => {
      worker?.terminate();
      worker = null;
    }, 10000);
  }
}
export function prepareModelPicking(geometry, build = generate) {
  const position = geometry.attributes?.position;
  const triangles = (geometry.index?.count || position?.count || 0) / 3;
  if (!position || triangles < 512) return Promise.resolve();
  if (prepared.has(geometry)) return prepared.get(geometry);
  const job = queue
    .catch(() => {})
    .then(async () => {
      // Workers receive independent buffers: interleaved GLB streams and shared
      // geometry remain intact while the acceleration structure is constructed.
      const input = new BufferGeometry(),
        values = new Float32Array(position.count * 3);
      for (let i = 0; i < position.count; i++) {
        values[i * 3] = position.getX(i);
        values[i * 3 + 1] = position.getY(i);
        values[i * 3 + 2] = position.getZ(i);
      }
      input.setAttribute("position", new BufferAttribute(values, 3));
      if (geometry.index)
        input.setIndex(new BufferAttribute(geometry.index.array.slice(), 1));
      input.groups = geometry.groups.map((group) => ({ ...group }));
      input.drawRange = { ...geometry.drawRange };
      const serialized = await build(input);
      geometry.boundsTree = MeshBVH.deserialize(serialized, geometry, {
        setIndex: false,
      });
      geometry.userData.bvhBytes =
        serialized.roots.reduce((n, root) => n + root.byteLength, 0) +
        (serialized.indirectBuffer?.byteLength || 0);
    });
  prepared.set(geometry, job);
  queue = job;
  return job;
}

const proxy = new Mesh(),
  instance = new Matrix4(),
  sphere = new Sphere(),
  hits = [];
export function modelRaycast(ray, result) {
  if (!this.isInstancedMesh) return acceleratedRaycast.call(this, ray, result);
  if (this.boundingSphere === null) this.computeBoundingSphere();
  sphere.copy(this.boundingSphere).applyMatrix4(this.matrixWorld);
  if (!ray.ray.intersectsSphere(sphere)) return;
  proxy.geometry = this.geometry;
  proxy.material = this.material;
  for (let i = 0; i < this.count; i++) {
    this.getMatrixAt(i, instance);
    proxy.matrixWorld.multiplyMatrices(this.matrixWorld, instance);
    acceleratedRaycast.call(proxy, ray, hits);
    for (const hit of hits) {
      hit.instanceId = i;
      hit.object = this;
      result.push(hit);
    }
    hits.length = 0;
  }
}
