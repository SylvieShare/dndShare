import {
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
} from "three";

export function createCameraMarkerGeometry() {
  const box = new BoxGeometry(0.38, 0.26, 0.3),
    lens = new CylinderGeometry(0.1, 0.14, 0.22, 12),
    sphere = new SphereGeometry(0.13, 12, 10);
  const boxEdges = new EdgesGeometry(box),
    lensEdges = new EdgesGeometry(lens);
  const edges = new LineBasicMaterial({
    color: 0x000000,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const material = () =>
    new MeshBasicMaterial({
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
  return {
    create(id, virtual) {
      const root = new Group(),
        body = new Group(),
        focus = new Group();
      const bodyMaterial = material(),
        focusMaterial = material(),
        haloMaterial = material();
      haloMaterial.side = BackSide;
      for (const [part, geometry, edgeGeometry, z] of [
        ["box", box, boxEdges, 0],
        ["lens", lens, lensEdges, 0.22],
      ]) {
        const mesh = new Mesh(geometry, bodyMaterial),
          outline = new LineSegments(edgeGeometry, edges);
        mesh.name = part;
        mesh.position.z = outline.position.z = z;
        if (part === "lens") mesh.rotation.x = outline.rotation.x = Math.PI / 2;
        mesh.renderOrder = 15;
        outline.renderOrder = 16;
        outline.raycast = () => {};
        body.add(mesh, outline);
      }
      const dot = new Mesh(sphere, focusMaterial),
        halo = new Mesh(sphere, haloMaterial);
      dot.renderOrder = 15;
      halo.renderOrder = 14;
      halo.scale.setScalar(1.5);
      halo.raycast = () => {};
      focus.add(halo, dot);
      for (const [node, part] of [
        [body, "body"],
        [focus, "target"],
      ])
        if (!virtual)
          Object.assign(node.userData, { cameraId: id, cameraPart: part });
      const frame = new LineSegments(
        new BufferGeometry().setFromPoints(
          Array.from({ length: 16 }, () => new Vector3()),
        ),
        new LineBasicMaterial({
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      frame.raycast = () => {};
      root.add(body, focus, frame);
      return {
        root,
        body,
        focus,
        frame,
        halo,
        bodyMaterial,
        focusMaterial,
        haloMaterial,
        dispose() {
          root.removeFromParent();
          bodyMaterial.dispose();
          focusMaterial.dispose();
          haloMaterial.dispose();
          frame.geometry.dispose();
          frame.material.dispose();
        },
      };
    },
    dispose() {
      for (const geometry of [box, lens, sphere, boxEdges, lensEdges])
        geometry.dispose();
      edges.dispose();
    },
  };
}
