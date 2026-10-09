import {
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
} from "three";
import { tileTransform } from "./tileTransform";
import { TILE_ACCENT, OBJECT_ACCENT } from "./mapAccents";

export function createTileOutline(gpu, assets) {
  const maskScene = new Scene(),
    root = new Group(),
    motion = new Group();
  maskScene.add(root, motion);
  const target = new WebGLRenderTarget(1, 1, { samples: 4 });
  const depth = new MeshBasicMaterial({ colorWrite: false });
  const hover = new MeshBasicMaterial({
    color: 0xff0000,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const selected = new MeshBasicMaterial({
    color: 0x00ff00,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const objectHover = hover.clone();
  objectHover.color.setRGB(0, 0, 0.55);
  const objectSelected = selected.clone();
  objectSelected.color.setHex(0x0000ff);
  const shader = new ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      mask: { value: target.texture },
      texel: { value: new Vector2(1, 1) },
      tileColour: { value: new Color(TILE_ACCENT) },
      objectColour: { value: new Color(OBJECT_ACCENT) },
    },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D mask; uniform vec2 texel; uniform vec3 tileColour; uniform vec3 objectColour;
      varying vec2 vUv;
      void main() {
        vec3 center = texture2D(mask, vUv).rgb;
        vec3 edge = vec3(0.0);
        for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) {
          vec2 offset = vec2(float(x), float(y)) * texel;
          edge.r = max(edge.r, texture2D(mask, vUv + offset).r);
          edge.g = max(edge.g, texture2D(mask, vUv + offset * 2.0).g);
          edge.b = max(edge.b, texture2D(mask, vUv + offset).b);
          float outerObject = texture2D(mask, vUv + offset * 2.0).b;
          edge.b = max(edge.b, outerObject * step(0.75, outerObject));
        }
        edge = max(edge - center, vec3(0.0));
        gl_FragColor = vec4(edge.b > 0.0 ? objectColour : tileColour, max(max(edge.r * 0.55, edge.g), edge.b));
        #include <colorspace_fragment>
      }`,
  });
  const overlay = new Scene(),
    quad = new Mesh(new PlaneGeometry(2, 2), shader);
  overlay.add(quad);
  const flatCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const size = new Vector2(),
    clearColour = new Color();
  let key = "",
    motionKey = "";
  function clear() {
    root.children.forEach((mesh) => mesh.dispose?.());
    root.clear();
  }
  function update(document, options, tier) {
    const selection = new Set(options.selectedTiles || [options.selectedTile]);
    const hidden = new Set(options.previewTile?.tileIds || []);
    const tiles = document.tiles
      .filter(
        (tile) =>
          options.master &&
          !hidden.has(tile.id) &&
          (selection.has(tile.id) || tile.id === options.hoveredTile),
      )
      .map((tile) => [tile, selection.has(tile.id) ? selected : hover]);
    if (options.previewTile?.wallBrush && options.master)
      tiles.push(...options.previewTile.group.map((tile) => [tile, hover]));
    const nextKey = JSON.stringify([
      assets.signature?.(new Set(document.tiles.map((t) => t.modelId)), tier),
      tiles.map(([tile, material]) => [tile, material === selected]),
      tier,
    ]);
    if (key === nextKey) return;
    key = nextKey;
    clear();
    const buckets = new Map();
    for (const [tile, material] of tiles) {
      const bucket = `${tile.modelId}:${material === selected}`;
      if (!buckets.has(bucket)) buckets.set(bucket, []);
      buckets.get(bucket).push([tile, material]);
    }
    for (const entries of buckets.values()) {
      const [first, material] = entries[0],
        model =
          assets.visual?.(first.modelId, tier) ||
          assets.model(first.modelId, tier),
        metadata = assets.metadata(first.modelId);
      if (!model || !metadata) continue;
      for (const part of model.parts) {
        const mesh = new InstancedMesh(part.geometry, material, entries.length);
        mesh.userData = { entries, metadata, partMatrix: part.matrix };
        entries.forEach(([tile], index) =>
          mesh.setMatrixAt(
            index,
            new Matrix4().multiplyMatrices(
              tileTransform(tile, metadata),
              part.matrix,
            ),
          ),
        );
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        root.add(mesh);
      }
    }
  }
  function syncMotion(previews) {
    const source = [];
    for (const preview of previews)
      if (preview.visible) {
        preview.updateMatrixWorld(true);
        preview.traverse((mesh) => {
          if (mesh.isMesh)
            source.push({
              mesh,
              material:
                preview.userData.outlineType === "object"
                  ? preview.userData.outlineStyle === "hover"
                    ? objectHover
                    : objectSelected
                  : preview.userData.outlineStyle === "hover"
                    ? hover
                    : selected,
            });
        });
      }
    const next = source
      .map(({ mesh, material }) => `${mesh.id}:${material.id}`)
      .join(",");
    if (next !== motionKey) {
      motion.children.forEach((mesh) => mesh.dispose?.());
      motion.clear();
      motionKey = next;
      for (const { mesh, material } of source) {
        const copy = mesh.isInstancedMesh
          ? new InstancedMesh(mesh.geometry, material, mesh.count)
          : new Mesh(mesh.geometry, material);
        copy.matrixAutoUpdate = false;
        copy.frustumCulled = false;
        motion.add(copy);
      }
    }
    source.forEach(({ mesh }, i) => {
      const copy = motion.children[i];
      copy.matrix.copy(mesh.matrixWorld);
      if (mesh.isInstancedMesh) {
        copy.instanceMatrix.array.set(mesh.instanceMatrix.array);
        copy.instanceMatrix.needsUpdate = true;
      }
    });
  }
  function render(
    scene,
    camera,
    annotations,
    previews,
    tileMatrix,
    excluded = [],
  ) {
    if (tileMatrix)
      for (const mesh of root.children) {
        const { entries, metadata, partMatrix } = mesh.userData;
        entries.forEach(([tile], i) =>
          mesh.setMatrixAt(
            i,
            new Matrix4().multiplyMatrices(
              tileMatrix(tile.id) || tileTransform(tile, metadata),
              partMatrix,
            ),
          ),
        );
        mesh.instanceMatrix.needsUpdate = true;
      }
    syncMotion(previews);
    if (!root.children.length && !motion.children.length) return;
    gpu.getDrawingBufferSize(size);
    if (target.width !== size.x || target.height !== size.y)
      target.setSize(size.x, size.y);
    shader.uniforms.texel.value.set(
      gpu.getPixelRatio() / size.x,
      gpu.getPixelRatio() / size.y,
    );
    const autoClear = gpu.autoClear,
      previousTarget = gpu.getRenderTarget(),
      background = scene.background,
      override = scene.overrideMaterial,
      annotationVisible = annotations.visible,
      previewVisible = previews.map((p) => p.visible),
      excludedVisible = excluded.map((p) => p.visible),
      shadowsEnabled = gpu.shadowMap.enabled,
      clearAlpha = gpu.getClearAlpha();
    gpu.getClearColor(clearColour);
    try {
      gpu.autoClear = false;
      gpu.setRenderTarget(target);
      gpu.setClearColor(0x000000, 0);
      gpu.clear();
      scene.background = null;
      scene.overrideMaterial = depth;
      annotations.visible = false;
      previews.forEach((p) => (p.visible = false));
      excluded.forEach((p) => (p.visible = false));
      gpu.shadowMap.enabled = false;
      // The depth prepass hides edges behind other models; the mask uses actual geometry.
      gpu.render(scene, camera);
      gpu.render(maskScene, camera);
      gpu.setRenderTarget(previousTarget);
      gpu.render(overlay, flatCamera);
    } finally {
      scene.background = background;
      scene.overrideMaterial = override;
      annotations.visible = annotationVisible;
      previews.forEach((p, i) => (p.visible = previewVisible[i]));
      excluded.forEach((p, i) => (p.visible = excludedVisible[i]));
      gpu.shadowMap.enabled = shadowsEnabled;
      gpu.setClearColor(clearColour, clearAlpha);
      gpu.autoClear = autoClear;
      gpu.setRenderTarget(previousTarget);
    }
  }
  function destroy() {
    clear();
    motion.children.forEach((mesh) => mesh.dispose?.());
    motion.clear();
    target.dispose();
    depth.dispose();
    hover.dispose();
    selected.dispose();
    objectHover.dispose();
    objectSelected.dispose();
    shader.dispose();
    quad.geometry.dispose();
  }
  return { update, render, destroy };
}
