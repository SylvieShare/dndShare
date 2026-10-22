import {
  Box3,
  BufferGeometry,
  Euler,
  Float32BufferAttribute,
  Matrix3,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
} from "three";
import { DecalGeometry } from "three/addons/geometries/DecalGeometry.js";

export function decalOrientation(normal, rotation = 0) {
  const up =
    Math.abs(normal.y) > 0.95 ? new Vector3(0, 0, -1) : new Vector3(0, 1, 0);
  const basis = new Matrix4().lookAt(normal, new Vector3(), up);
  const q = new Quaternion()
    .setFromRotationMatrix(basis)
    .multiply(
      new Quaternion().setFromAxisAngle(
        new Vector3(0, 0, 1),
        (rotation * Math.PI) / 180,
      ),
    );
  return new Euler().setFromQuaternion(q);
}

// Project only front-facing triangles near the stamp. Keep the owner's shared
// source geometry untouched and build only when its visual/projection changes.
export function projectedDecalGeometry(part, decal) {
  const normal = new Vector3(...decal.normal).normalize();
  const orientation = decalOrientation(normal, decal.rotation);
  const position = new Vector3(...decal.position);
  const projector = new Matrix4()
    .makeRotationFromEuler(orientation)
    .setPosition(position)
    .invert();
  const localProjector = projector.clone().multiply(part.matrix);
  const normalMatrix = new Matrix3().getNormalMatrix(part.matrix);
  const source = part.geometry,
    index = source.index,
    vertices = source.attributes.position,
    normals = source.attributes.normal;
  const positions = [],
    directions = [],
    a = new Vector3(),
    b = new Vector3(),
    c = new Vector3(),
    face = new Vector3(),
    edge = new Vector3();
  const half = new Vector3(decal.width / 2, decal.height / 2, decal.depth / 2);
  const points = [new Vector3(), new Vector3(), new Vector3()];
  const count = index?.count ?? vertices.count;
  function collect(i) {
    const ids = [0, 1, 2].map((n) => (index ? index.getX(i + n) : i + n));
    a.fromBufferAttribute(vertices, ids[0]);
    b.fromBufferAttribute(vertices, ids[1]);
    c.fromBufferAttribute(vertices, ids[2]);
    face
      .subVectors(b, a)
      .cross(edge.subVectors(c, a))
      .applyMatrix3(normalMatrix)
      .normalize();
    if (face.dot(normal) < 0.15) return;
    points[0].copy(a).applyMatrix4(localProjector);
    points[1].copy(b).applyMatrix4(localProjector);
    points[2].copy(c).applyMatrix4(localProjector);
    if (
      ["x", "y", "z"].some(
        (axis) =>
          points.every((p) => p[axis] < -half[axis]) ||
          points.every((p) => p[axis] > half[axis]),
      )
    )
      return;
    for (const id of ids) {
      const vertex = a.fromBufferAttribute(vertices, id);
      positions.push(vertex.x, vertex.y, vertex.z);
      if (normals) vertex.fromBufferAttribute(normals, id);
      else
        vertex
          .copy(face)
          .applyMatrix3(
            new Matrix3().getNormalMatrix(part.matrix.clone().invert()),
          )
          .normalize();
      directions.push(vertex.x, vertex.y, vertex.z);
    }
  }
  if (source.boundsTree) {
    const bounds = new Box3(half.clone().negate(), half.clone()).applyMatrix4(
      localProjector.clone().invert(),
    );
    source.boundsTree.shapecast({
      intersectsBounds: (box) => bounds.intersectsBox(box),
      intersectsTriangle: (_triangle, triangleIndex) => {
        collect(triangleIndex * 3);
        return false;
      },
    });
  } else for (let i = 0; i < count; i += 3) collect(i);
  const candidate = new BufferGeometry();
  candidate.setAttribute("position", new Float32BufferAttribute(positions, 3));
  candidate.setAttribute("normal", new Float32BufferAttribute(directions, 3));
  const mesh = new Mesh(candidate);
  mesh.matrixWorld.copy(part.matrix);
  const geometry = new DecalGeometry(
    mesh,
    position,
    orientation,
    new Vector3(decal.width, decal.height, decal.depth),
  );
  candidate.dispose();
  return geometry;
}

export function hitDecalSurface(hit, ownerMatrix) {
  if (!hit?.face || !ownerMatrix) return null;
  const matrix = hit.object.matrixWorld.clone();
  if (hit.object.isInstancedMesh) {
    const instance = new Matrix4();
    hit.object.getMatrixAt(hit.instanceId, instance);
    matrix.multiply(instance);
  }
  const inverse = ownerMatrix.clone().invert();
  const position = hit.point.clone().applyMatrix4(inverse);
  const normal = hit.face.normal
    .clone()
    .applyMatrix3(new Matrix3().getNormalMatrix(matrix));
  normal.applyMatrix3(new Matrix3().getNormalMatrix(inverse)).normalize();
  return { position: position.toArray(), normal: normal.toArray() };
}
