import {
  ACESFilmicToneMapping,
  Box3,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { modelAssets } from "./modelAssets";
import { tileBounds, tileTransform } from "./tileTransform";
import { modelPreviewCamera } from "./modelPreviewCamera";
import { modelPreviewGuides } from "./modelPreviewGuides";
import {
  layoutPreviewLabels,
  previewGeometry,
} from "../lib/modelPreviewGeometry";

export function createModelPreview(host, onFrame, onError) {
  const gpu = new WebGLRenderer({ antialias: true, alpha: true });
  gpu.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  gpu.toneMapping = ACESFilmicToneMapping;
  const scene = new Scene(),
    root = new Group(),
    guides = modelPreviewGuides();
  scene.add(root, guides.root, new HemisphereLight(0xffffff, 0x625141, 2));
  for (const [color, intensity, position] of [
    [0xfff2df, 3, [-20, 40, -25]],
    [0xe0e8ff, 0.6, [20, 12, 25]],
  ]) {
    const light = new DirectionalLight(color, intensity);
    light.position.set(...position);
    scene.add(light);
  }
  host.appendChild(gpu.domElement);
  let frame = 0,
    dead = false,
    epoch = 0,
    current = null,
    asset = null,
    fitKey = "",
    bounds = new Box3();
  let assets = modelAssets(onError),
    options = {};
  function render() {
    if (frame || dead) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (dead) return;
      gpu.render(scene, view.camera);
      const data = guides.descriptors(),
        project = (p) => ({ ...p, ...view.project(p.position) });
      onFrame({
        labels: layoutPreviewLabels(
          data.labels.map(project),
          host.clientWidth,
          host.clientHeight,
        ),
        ports: data.ports.map(project),
        sockets: data.sockets.map(project),
        view: view.view(),
      });
    });
  }
  const view = modelPreviewCamera(gpu, host, render);
  function update(model, next = options) {
    current = model;
    options = next;
    if (!asset) return;
    const g = previewGeometry(model),
      safe = {
        ...model,
        width: g.width,
        height: g.height,
        mountDepth: g.mount,
        placementOffset: g.offset,
      };
    const tile = { x: 0, y: 0, rotation: 0, elevation: 0 };
    root.matrixAutoUpdate = false;
    root.matrix.copy(tileTransform(tile, safe));
    root.updateMatrixWorld(true);
    bounds = tileBounds(tile, safe, asset);
    const annotations = guides.update(model, bounds, options);
    const fit = bounds.clone();
    fit.expandByPoint(new Vector3(0, g.bottom, 0));
    fit.expandByPoint(
      new Vector3(g.width + 1.1, Math.max(g.top, 0), g.height + 0.7),
    );
    for (const p of [...annotations.ports, ...annotations.sockets])
      fit.expandByPoint(new Vector3(...p.position));
    const key = JSON.stringify([model.id, g, model.supportSlots]);
    if (key !== fitKey) {
      fitKey = key;
      view.fit(fit);
    }
    render();
  }
  return {
    async load(source, model, next) {
      const id = ++epoch;
      current = model;
      options = next;
      root.clear();
      asset = null;
      fitKey = "";
      assets.destroy();
      assets = modelAssets(onError);
      const owner = assets;
      await owner.ensure(new Set([source.id]), "render", {
        catalogue: [source],
      });
      if (dead || id !== epoch) return;
      asset = owner.model(source.id, "render");
      for (const part of asset.parts) {
        const mesh = new Mesh(part.geometry, part.material);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(part.matrix);
        root.add(mesh);
      }
      update(current, options);
    },
    update,
    rotate: view.rotate,
    zoom: view.zoom,
    resize: view.resize,
    fit() {
      fitKey = "";
      if (current) update(current, options);
    },
    hit(event) {
      return view
        .ray(event)
        .intersectObjects(guides.root.children, false)
        .find(
          (hit) =>
            hit.object.userData.port !== undefined ||
            hit.object.userData.slot !== undefined ||
            hit.object.userData.point !== undefined,
        )?.object.userData;
    },
    destroy() {
      dead = true;
      epoch++;
      cancelAnimationFrame(frame);
      root.clear();
      guides.destroy();
      assets.destroy();
      gpu.dispose();
      gpu.domElement.remove();
    },
  };
}
