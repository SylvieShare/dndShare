import {
  WebGLRenderer,
  Scene,
  Group,
  OrthographicCamera,
  HemisphereLight,
  DirectionalLight,
  Box3,
  Vector3,
  Matrix4,
  MeshStandardMaterial,
  Mesh,
  PlaneGeometry,
} from "three";
import { acquireModelLoader } from "/src/features/maps/rendering/modelLoader.js";
import { createTileLayer } from "/src/features/maps/rendering/tileLayer.js";
import { createMapFog } from "/src/features/maps/rendering/mapFog.js";
import {
  createModelWaterAnimation,
  modelWaterMaterial,
} from "/src/features/maps/rendering/modelWater.js";

const size = 512,
  gpu = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
gpu.setSize(size, size);
document.body.append(gpu.domElement);
const loader = acquireModelLoader(gpu),
  water = createModelWaterAnimation(),
  fog = createMapFog();
fog.update({ width: 160, height: 160, zones: [] }, null, true);
function pixels() {
  const gl = gpu.getContext(),
    p = new Uint8Array(size * size * 4);
  gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, p);
  return p;
}
function diagnostic(root, enabled) {
  root.traverse((n) => {
    for (const m of Array.isArray(n.material)
      ? n.material
      : n.material
        ? [n.material]
        : []) {
      if (enabled) {
        m.userData.reviewCompile = m.onBeforeCompile;
        m.userData.reviewKey = m.customProgramCacheKey;
        const before = m.onBeforeCompile;
        m.onBeforeCompile = (s, r) => {
          before.call(m, s, r);
          s.fragmentShader = s.fragmentShader.replace(
            "#include <opaque_fragment>",
            `outgoingLight=vec3(${s.uniforms.waterClock ? "waterCoverage" : "0.0"});\n#include <opaque_fragment>`,
          );
        };
        m.customProgramCacheKey = () =>
          `${m.userData.reviewKey.call(m)}:coverage-review`;
      } else {
        m.onBeforeCompile = m.userData.reviewCompile;
        m.customProgramCacheKey = m.userData.reviewKey;
        delete m.userData.reviewCompile;
        delete m.userData.reviewKey;
      }
      m.needsUpdate = true;
    }
  });
}
window.reviewWaterMaterials = async (tier, model, profile, angle = 0) => {
  const gltf = await loader.load(
    `/water-review/${model.assets[tier].sha256}.glb`,
  );
  gltf.scene.updateMatrixWorld(true);
  const parts = [];
  gltf.scene.traverse((n) => {
    if (n.isMesh)
      parts.push({
        geometry: n.geometry,
        material: n.material,
        matrix: n.matrixWorld.clone(),
      });
  });
  const settings = { ...profile, enabled: true, speed: 1, strength: 0.7 },
    metadata = { ...model, behaviour: { waterAnimation: settings } };
  const layer = createTileLayer(
    { metadata: () => metadata, visual: () => ({ parts }) },
    fog,
  );
  layer.rebuild(
    [{ id: "tile", modelId: model.id, x: 0, y: 0, rotation: angle }],
    tier,
    [],
  );
  layer.advance(1000);
  const scene = new Scene();
  scene.add(layer.root, new HemisphereLight(0xffffff, 0x625141, 2));
  const sun = new DirectionalLight(0xfff2df, 3);
  sun.position.set(-3, 6, 4);
  scene.add(sun);
  const bounds = new Box3().setFromObject(layer.root),
    center = bounds.getCenter(new Vector3());
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 1000),
    span = Math.max(bounds.getSize(new Vector3()).length() * 0.63, 0.6);
  camera.top = span;
  camera.bottom = -span;
  camera.left = -span;
  camera.right = span;
  camera.updateProjectionMatrix();
  camera.position.copy(center).add(new Vector3(4, 5, 6));
  camera.lookAt(center);
  water.update([layer.root]);
  const render = (time) => {
    water.advance(time);
    gpu.render(scene, camera);
    return pixels();
  };
  const a = render(0),
    same = render(60),
    b = render(350);
  diagnostic(layer.root, true);
  gpu.render(scene, camera);
  const mask = pixels(),
    maskImage = gpu.domElement.toDataURL();
  diagnostic(layer.root, false);
  let animated = 0,
    dryChanged = 0,
    sameChanged = 0,
    wetPixels = 0,
    dryPixels = 0;
  for (let i = 0; i < a.length; i += 4) {
    const delta = Math.max(
      ...[0, 1, 2].map((c) => Math.abs(a[i + c] - b[i + c])),
    );
    if (mask[i] > 250) {
      wetPixels++;
      if (delta > 3) animated++;
    }
    if (mask[i] < 2) {
      dryPixels++;
      if (delta > 3) dryChanged++;
    }
    if ([0, 1, 2].some((c) => a[i + c] !== same[i + c])) sameChanged++;
  }
  settings.enabled = false;
  const offA = render(500),
    offB = render(1000);
  settings.enabled = true;
  render(350);
  const frameImage = gpu.domElement.toDataURL();
  const frozen = offA.every((v, i) => v === offB[i]);
  const materialCount = layer.root.children.length;
  layer.destroy();
  water.update([]);
  const textures = new Set();
  gltf.scene.traverse((n) => {
    if (!n.isMesh) return;
    n.geometry.dispose();
    for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
      for (const t of Object.values(m)) if (t?.isTexture) textures.add(t);
      m.dispose();
    }
  });
  textures.forEach((t) => {
    t.dispose();
    t.source?.data?.close?.();
  });
  gpu.renderLists.dispose();
  return {
    animated,
    dryChanged,
    sameChanged,
    wetPixels,
    dryPixels,
    frozen,
    materialCount,
    frameImage,
    maskImage,
  };
};

// Two different model origins represent the same world surface. Their wave
// frames must agree, including when the geometry carries no custom attributes.
window.waterContinuity = () => {
  const settings = {
    enabled: true,
    speed: 1,
    strength: 0.7,
    pattern: "surface",
    roughnessMax: 0.4,
    center: [0, 0],
  };
  const a = new PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
    b = a.clone().translate(-1, 0, 0);
  const ma = modelWaterMaterial(
      new MeshStandardMaterial({ color: 0x4d9eaf, roughness: 0.3 }),
      { geometry: a, matrix: new Matrix4() },
      settings,
    ),
    mb = modelWaterMaterial(
      new MeshStandardMaterial({ color: 0x4d9eaf, roughness: 0.3 }),
      { geometry: b, matrix: new Matrix4() },
      settings,
    );
  const left = new Mesh(a, ma),
    right = new Mesh(b, mb);
  right.position.x = 1;
  const scene = new Scene();
  scene.add(left, right, new HemisphereLight(0xffffff, 0x625141, 2));
  const camera = new OrthographicCamera(-1.1, 1.1, 1.1, -1.1, 0.01, 100);
  camera.position.set(0, 5, 0.00001);
  camera.lookAt(0, 0, 0);
  water.update([scene]);
  water.advance(350);
  right.visible = false;
  gpu.render(scene, camera);
  const first = pixels();
  right.visible = true;
  left.visible = false;
  gpu.render(scene, camera);
  const second = pixels();
  let changed = 0;
  for (let i = 0; i < first.length; i += 4)
    if (
      Math.max(
        ...[0, 1, 2].map((c) => Math.abs(first[i + c] - second[i + c])),
      ) > 2
    )
      changed++;
  a.dispose();
  b.dispose();
  ma.dispose();
  mb.dispose();
  water.update([]);
  return changed;
};
