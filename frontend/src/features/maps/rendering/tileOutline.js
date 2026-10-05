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

export function createTileOutline(gpu, assets) {
  const maskScene = new Scene(),
    root = new Group();
  maskScene.add(root);
  const target = new WebGLRenderTarget(1, 1, { samples: 4 });
  const depth = new MeshBasicMaterial({ colorWrite: false });
  const hover = new MeshBasicMaterial({
    color: 0xff0000,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const selected = new MeshBasicMaterial({
    color: 0x00ff00,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const shader = new ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      mask: { value: target.texture },
      texel: { value: new Vector2(1, 1) },
      colour: { value: new Color(0xf2d397) },
    },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D mask; uniform vec2 texel; uniform vec3 colour;
      varying vec2 vUv;
      void main() {
        vec2 center = texture2D(mask, vUv).rg;
        vec2 edge = vec2(0.0);
        for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) {
          vec2 offset = vec2(float(x), float(y)) * texel;
          edge.r = max(edge.r, texture2D(mask, vUv + offset).r);
          edge.g = max(edge.g, texture2D(mask, vUv + offset * 2.0).g);
        }
        edge = max(edge - center, vec2(0.0));
        gl_FragColor = vec4(colour, max(edge.r * 0.55, edge.g));
        #include <colorspace_fragment>
      }`,
  });
  const overlay = new Scene(),
    quad = new Mesh(new PlaneGeometry(2, 2), shader);
  overlay.add(quad);
  const flatCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const size = new Vector2(),
    clearColour = new Color();
  let key = "";
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
        model = assets.model(first.modelId, tier),
        metadata = assets.metadata(first.modelId);
      if (!model || !metadata) continue;
      for (const part of model.parts) {
        const mesh = new InstancedMesh(part.geometry, material, entries.length);
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
  function render(scene, camera, annotations, preview) {
    if (!root.children.length) return;
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
      previewVisible = preview.visible,
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
      preview.visible = false;
      // The depth prepass hides edges behind other models; the mask uses actual geometry.
      gpu.render(scene, camera);
      gpu.render(maskScene, camera);
      gpu.setRenderTarget(previousTarget);
      gpu.render(overlay, flatCamera);
    } finally {
      scene.background = background;
      scene.overrideMaterial = override;
      annotations.visible = annotationVisible;
      preview.visible = previewVisible;
      gpu.setClearColor(clearColour, clearAlpha);
      gpu.autoClear = autoClear;
      gpu.setRenderTarget(previousTarget);
    }
  }
  function destroy() {
    clear();
    target.dispose();
    depth.dispose();
    hover.dispose();
    selected.dispose();
    shader.dispose();
    quad.geometry.dispose();
  }
  return { update, render, destroy };
}
