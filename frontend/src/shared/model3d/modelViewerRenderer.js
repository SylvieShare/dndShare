import {
  ACESFilmicToneMapping,
  Box3,
  DirectionalLight,
  Group,
  HemisphereLight,
  Scene,
  WebGLRenderer,
} from "three";
import { acquireModelLoader } from "./modelLoader";
import { createModelOrbitCamera } from "./modelOrbitCamera";
import { modelOrbitControls } from "./modelOrbitControls";

function disposeModel(root) {
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set(),
    images = new Set();
  root.traverse((node) => {
    if (!node.isMesh) return;
    geometries.add(node.geometry);
    for (const material of [node.material].flat().filter(Boolean)) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value?.isTexture) textures.add(value);
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => {
    images.add(t.source?.data);
    t.dispose();
  });
  images.forEach((i) => i?.close?.());
}

export function createModelViewer(host, changed = () => {}) {
  const gpu = new WebGLRenderer({ antialias: true, alpha: true });
  gpu.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.5));
  gpu.toneMapping = ACESFilmicToneMapping;
  host.append(gpu.domElement);
  const scene = new Scene(),
    root = new Group();
  scene.add(root, new HemisphereLight(0xffffff, 0x625141, 2));
  for (const [intensity, position] of [
    [2.5, [-2, 4, 3]],
    [0.7, [3, 2, -2]],
  ]) {
    const light = new DirectionalLight(0xffffff, intensity);
    light.position.set(...position);
    scene.add(light);
  }
  let frame = 0,
    dead = false,
    serial = 0,
    bounds = null;
  function draw() {
    if (dead || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (dead) return;
      gpu.render(scene, view.camera);
      changed(view.view());
    });
  }
  const view = createModelOrbitCamera(gpu, host, draw, {
    yaw: -Math.PI / 3,
    pitch: 0.35,
    minSpan: 0.1,
    minPitch: -1.45,
    projectedFit: true,
  });
  const loader = acquireModelLoader(gpu);
  const fit = () => {
    if (bounds) view.fit(bounds, root);
  };
  const unbind = modelOrbitControls(host, view, fit);
  function clear() {
    disposeModel(root);
    root.clear();
    bounds = null;
  }
  return {
    async load(url, bytes, signal) {
      const id = ++serial;
      clear();
      draw();
      const model = await loader.load(
        url,
        (fn) => fn(),
        undefined,
        signal,
        bytes,
      );
      if (dead || id !== serial || signal?.aborted) {
        disposeModel(model.scene);
        signal?.throwIfAborted();
        return;
      }
      // Preserve the complete GLB hierarchy and native transforms.
      model.scene.updateMatrixWorld(true);
      const box = new Box3().setFromObject(model.scene);
      if (box.isEmpty()) {
        disposeModel(model.scene);
        throw new Error("В модели нет геометрии");
      }
      root.add(model.scene);
      bounds = box;
      fit();
    },
    resize() {
      view.resize();
      if (bounds && view.view().zoom === 1) fit();
    },
    zoom: view.zoom,
    fit,
    destroy() {
      dead = true;
      serial++;
      cancelAnimationFrame(frame);
      unbind();
      clear();
      loader.release();
      gpu.dispose();
      gpu.forceContextLoss();
      gpu.domElement.remove();
    },
  };
}
