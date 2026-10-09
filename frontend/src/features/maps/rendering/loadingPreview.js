import {
  Group,
  Mesh,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  ShaderMaterial,
  DoubleSide,
} from "three";
import { tilePose } from "./tileTransform";
import { tileSize } from "../lib/tilePlacement";
export function createLoadingPreview(assets, onChange = () => {}) {
  const root = new Group(),
    geometry = new PlaneGeometry(1, 1);
  const material = new ShaderMaterial({
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    uniforms: { time: { value: 0 }, opacity: { value: 0.95 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv;vec4 p=vec4(position,1.0);
        #ifdef USE_INSTANCING
        p=instanceMatrix*p;
        #endif
        gl_Position=projectionMatrix*modelViewMatrix*p; }`,
    fragmentShader: `varying vec2 vUv; uniform float time; uniform float opacity;
      void main(){
        vec2 p=vUv-0.5; float radius=length(p);
        float checker=mod(floor(vUv.x*8.0)+floor(vUv.y*8.0),2.0);
        vec3 colour=mix(vec3(0.22,0.075,0.4),vec3(0.36,0.16,0.62),checker);
        float ring=1.0-smoothstep(0.0,0.02,abs(radius-0.2));
        float angle=mod(atan(p.y,p.x)-time*3.0+6.283185,6.283185)/6.283185;
        colour=mix(colour,vec3(0.9,0.77,1.0),ring*(0.15+0.85*angle));
        float border=step(0.46,max(abs(p.x),abs(p.y)));
        gl_FragColor=vec4(mix(colour,vec3(0.67,0.43,0.96),border),opacity);
        #include <colorspace_fragment>
      }`,
  });
  let count = 0,
    time = 0;
  function clear() {
    for (const node of root.children) {
      node.dispose?.();
      if (node.material !== material) node.material.dispose();
    }
    root.clear();
  }
  function visual(id, tier) {
    return assets.visual?.(id, tier) || assets.model(id, tier);
  }

  function update(options, catalogue = [], scene = {}) {
    clear();
    let pendingCount = 0;
    const metadata = new Map(catalogue.map((m) => [m.id, m]));
    const tiles =
      options.previewTile?.group ||
      (options.previewTile ? [options.previewTile] : []);
    const objects =
      options.previewObject?.group ||
      (options.previewObject ? [options.previewObject] : []);
    for (const [items, type] of [
      [tiles, "tile"],
      [objects, "object"],
    ])
      for (const item of items) {
        if (assets.model(item.modelId, "render")) continue;
        const model =
          metadata.get(item.modelId) || assets.metadata(item.modelId);
        if (!model) continue;
        const mesh = new Mesh(geometry, material),
          size =
            type === "tile"
              ? tileSize(item, model)
              : { width: 0.76, height: 0.76 };
        const pose = type === "tile" ? tilePose(item, model) : item;
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(pose.x, (pose.elevation || 0) + 0.24, pose.y);
        mesh.scale.set(size.width, size.height, 1);
        mesh.userData = { item, kind: type };
        root.add(mesh);
        pendingCount++;
      }
    const batches = new Map(),
      matrix = new Matrix4(),
      poseMesh = new Mesh(geometry);
    for (const [items, kind, opacity] of [
      [scene.tiles || [], "tile", scene.tileOpacity],
      [scene.objects || [], "object", scene.objectOpacity],
    ])
      for (const item of items) {
        if (visual(item.modelId, scene.tier || "render")) continue;
        const model =
          metadata.get(item.modelId) || assets.metadata(item.modelId);
        if (!model) continue;
        const alpha = opacity?.(item.id) ?? 1;
        const key = `${kind}:${alpha}`;
        if (!batches.has(key)) batches.set(key, { kind, alpha, items: [] });
        batches.get(key).items.push({ item, model });
        pendingCount++;
      }
    for (const { kind, alpha, items } of batches.values()) {
      const instanceMaterial = material.clone();
      instanceMaterial.uniforms.opacity.value = 0.95 * alpha;
      const mesh = new InstancedMesh(geometry, instanceMaterial, items.length);
      mesh.frustumCulled = false;
      mesh.userData = { kind, items: items.map(({ item }) => item) };
      items.forEach(({ item, model }, i) => {
        const pose = kind === "tile" ? tilePose(item, model) : item,
          size =
            kind === "tile"
              ? tileSize(item, model)
              : {
                  width: 0.76 * (item.scale || 1),
                  height: 0.76 * (item.scale || 1),
                };
        poseMesh.rotation.set(
          -Math.PI / 2,
          0,
          kind === "object" ? (-(item.rotation || 0) * Math.PI) / 180 : 0,
        );
        poseMesh.position.set(pose.x, (pose.elevation || 0) + 0.24, pose.y);
        poseMesh.scale.set(size.width, size.height, 1);
        poseMesh.updateMatrix();
        mesh.setMatrixAt(i, matrix.copy(poseMesh.matrix));
      });
      mesh.instanceMatrix.needsUpdate = true;
      root.add(mesh);
    }
    root.visible = !!root.children.length;
    if (count !== pendingCount) {
      count = pendingCount;
      onChange(count);
    }
    root.updateMatrixWorld(true);
  }
  return {
    root,
    update,
    advance(delta) {
      time += delta / 1000;
      material.uniforms.time.value = time;
      for (const node of root.children)
        node.material.uniforms.time.value = time;
      return root.visible;
    },
    hit(ray) {
      const hit = ray.intersectObjects(root.children, false)[0];
      if (!hit) return null;
      const item =
        hit.object.userData.items?.[hit.instanceId] || hit.object.userData.item;
      if (!item?.id) return null;
      return {
        [hit.object.userData.kind === "tile" ? "tileId" : "objectId"]: item.id,
        distance: hit.distance,
        point: { x: hit.point.x, y: hit.point.z, elevation: hit.point.y },
      };
    },
    destroy() {
      clear();
      geometry.dispose();
      material.dispose();
    },
  };
}
