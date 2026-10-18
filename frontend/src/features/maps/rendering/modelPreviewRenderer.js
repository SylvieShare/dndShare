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
import { createMapEffects } from "./mapEffects";
import { createMapFog } from "./mapFog";
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
    timer = 0,
    labelsDirty = true,
    lastEffectFrame = 0,
    dead = false,
    epoch = 0,
    current = null,
    asset = null,
    fitKey = "",
    bounds = new Box3();
  let assets = modelAssets(onError, gpu),
    options = {};
  const fog = createMapFog(),
    effects = createMapEffects(
      scene,
      fog,
      { catalogue: () => assets.catalogue() },
      render,
    );
  fog.update({ width: 160, height: 160, zones: [] }, null, true);
  function clearRoot() {
    for (const mesh of root.children)
      for (const material of Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material])
        material.dispose();
    root.clear();
  }
  function render(animationOnly = false) {
    if (!animationOnly) labelsDirty = true;
    if (frame || dead) return;
    clearTimeout(timer);
    timer = 0;
    frame = requestAnimationFrame((time) => {
      frame = 0;
      if (dead) return;
      const effectFrame = effects.advance(
          time,
          Math.min(40, time - lastEffectFrame || 16),
          () => root.matrix,
          root,
        ),
        delay = effectFrame.delay;
      lastEffectFrame = time;
      gpu.render(scene, view.camera);
      if (effectFrame.moving) render(true);
      else if (Number.isFinite(delay))
        timer = setTimeout(() => render(true), Math.max(1, delay));
      if (!labelsDirty) return;
      labelsDirty = false;
      const data = guides.descriptors(),
        project = (p) => ({ ...p, ...view.project(p.position) });
      onFrame({
        ready: !!asset,
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
    const behaviour =
        options.behaviour || assets.metadata(model.id)?.behaviour || {},
      anchor = { kind: "tile", id: "preview-tile" },
      previewDocument = {
        width: model.width,
        height: model.height,
        areas: [],
        zones: [],
        objects: [],
        tiles: [{ id: anchor.id, modelId: model.id, x: 0, y: 0, rotation: 0 }],
        lights: (behaviour.defaultLights || []).map((l) => ({
          ...l,
          id: `light-${l.key}`,
          builtinKey: l.key,
          anchor,
          x: 0,
          y: 0,
          elevation: 0,
          height: l.position[2],
        })),
      };
    assets.replaceCatalogue([
      { ...assets.metadata(model.id), ...model, behaviour },
    ]);
    effects.update(previewDocument, {}, null, previewDocument.tiles, []);
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
    fit.union(new Box3().setFromObject(effects.root));
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
      options = next || {};
      clearTimeout(timer);
      clearRoot();
      asset = null;
      fitKey = "";
      assets.destroy();
      effects.update(
        { lights: [], tiles: [], objects: [], areas: [] },
        {},
        null,
        [],
        [],
      );
      const owner = modelAssets(onError, gpu, () => populate());
      assets = owner;
      function populate() {
        if (dead || id !== epoch) return;
        const nextAsset = owner.visual(source.id, "render");
        if (!nextAsset || nextAsset === asset) return;
        asset = nextAsset;
        clearRoot();
        for (const part of asset.parts) {
          const materials = (
            Array.isArray(part.material) ? part.material : [part.material]
          ).map((m) => m.clone());
          const mesh = new Mesh(
            part.geometry,
            Array.isArray(part.material) ? materials : materials[0],
          );
          mesh.matrixAutoUpdate = false;
          mesh.matrix.copy(part.matrix);
          root.add(mesh);
        }
        update(current, options);
      }
      await owner.prepare(new Set([source.id]), { catalogue: [source] });
      populate();
      await owner.ensure(new Set([source.id]), "render", {
        catalogue: [source],
      });
      if (dead || id !== epoch) return;
      populate();
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
      clearTimeout(timer);
      clearRoot();
      guides.destroy();
      effects.destroy();
      fog.destroy();
      assets.destroy();
      gpu.dispose();
      gpu.domElement.remove();
    },
  };
}
