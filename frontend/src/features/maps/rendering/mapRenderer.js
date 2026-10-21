import { createSceneSynchronizer } from "./sceneSynchronizer";
import { createAreaTransitions } from "./areaTransitions";
import { createModelTransitions } from "./modelTransitions";
import { createAssetView } from "./assetView";
import { createSceneSelection } from "./sceneSelection";
import { modelTier } from "./modelTier";
import { modelVisual } from "./modelVisual";
import { createMapFrameLoop } from "./mapFrameLoop";
import { createRenderProfiler } from "./renderProfiler";
import { createMapFramePresentation } from "./mapFramePresentation";
import { createVolumeFog } from "./volumeFogRenderer";
import { pickMapScene, visibleSceneHits } from "./mapScenePicking";
import { createMapAreaPreview } from "./mapAreaPreview";
import { createMapFramePreview } from "./mapFramePreview";
import { createLightSourceState } from "./lightSourceState";
import { createMapLighting } from "./mapLighting";
import { createMapEffects } from "./mapEffects";
import { createModelWaterAnimation } from "./modelWater";
import { areaAppearance } from "../lib/mapAreas";
import { mapScreenQueries } from "./mapScreenQueries";
import { createLoadingPreview } from "./loadingPreview";
import { createObjectMotion } from "./objectMotion";
import { objectPlacementAnchors } from "./objectPlacementAnchors";
import {
  ACESFilmicToneMapping,
  Color,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { modelAssets } from "./modelAssets";
import { createMapFog } from "./mapFog";
import { createTileLayer } from "./tileLayer";
import { createMapAnnotations } from "./mapAnnotations";
import { createSceneObjectLayer } from "./sceneObjectLayer";
import { createTokenPortraits } from "./sceneTokens";
import { mapCamera } from "./mapCamera";
import { createTilePreview } from "./tilePreview";
import { createTileOutline } from "./tileOutline";
import { structureView } from "./structureView";
import { createObjectPreview } from "./objectPreview";
import { createPlacementAnchors } from "./placementAnchors";
import { createMapSnapshot } from "./mapRendererSnapshot";

export async function createMapRenderer(
  host,
  onError,
  onPreviewLoading,
  onDownloadProgress,
  { snapshotOnly = false } = {},
) {
  const gpu = new WebGLRenderer({ antialias: false, depth: false });
  gpu.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  gpu.toneMapping = ACESFilmicToneMapping;
  gpu.toneMappingExposure = 1;
  const scene = new Scene();
  scene.matrixAutoUpdate = false;
  scene.userData.outlineRevision = 0;
  scene.background = new Color(0x161b23);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 2000);
  host.appendChild(gpu.domElement);
  let dead = false,
    active = true,
    assetFrame = 0,
    loop;
  const runtime = {
    current: null,
    options: {},
    state: null,
    tier: "render",
    appearance: areaAppearance({ areas: [] }),
    placedTiles: [],
    posedObjects: [],
    posedTokens: [],
    renderObjects: [],
    movingIds: new Set(),
    modelIds: new Set(),
    visibleScene: null,
    scenePreviewOptions: {},
    selectedToken: null,
  };
  const profiler = createRenderProfiler(gpu, render);
  const annotations = createMapAnnotations(scene);
  const assets = modelAssets(onError, gpu, assetsChanged, onDownloadProgress),
    lightSources = createLightSourceState(assets),
    lighting = createMapLighting(
      scene,
      gpu,
      assets,
      assetsChanged,
      lightSources,
      camera,
      snapshotOnly ? { shadowSize: 256, sunShadowSize: 512 } : undefined,
    ),
    loadingPreview = createLoadingPreview(assets, onPreviewLoading),
    fog = createMapFog(),
    effects = createMapEffects(scene, fog, assets, render, lightSources),
    water = createModelWaterAnimation(),
    transitions = createAreaTransitions(assetsChanged),
    modelTransitions = createModelTransitions(assetsChanged),
    volumeFog = createVolumeFog(gpu, fog.uniforms, transitions),
    tokenPortraits = createTokenPortraits(render),
    tiles = createTileLayer(assets, fog),
    objectLayer = createSceneObjectLayer(assets, fog, tokenPortraits),
    objects = objectLayer.root,
    objectMotion = createObjectMotion(
      assets,
      (id) => preview.transform(id) || tiles.transform(id),
    ),
    preview = createTilePreview(assets, () => {
      if (runtime.current) {
        refreshVisible();
        selection.update(runtime.options, view.getView());
      }
    }),
    outline = createTileOutline(gpu, assets),
    objectPreview = createObjectPreview(fog, assets),
    surfaceAnchors = objectPlacementAnchors(),
    anchors = createPlacementAnchors();
  scene.add(
    objects,
    tiles.root,
    loadingPreview.root,
    preview.root,
    objectPreview.root,
    anchors.root,
    surfaceAnchors.root,
  );
  function assetsChanged() {
    if (snapshotOnly || dead || !active || assetFrame || !runtime.current)
      return;
    assetFrame = requestAnimationFrame(() => {
      assetFrame = 0;
      if (!dead && runtime.current)
        update(runtime.current, runtime.state, {
          ...runtime.options,
          sceneChanges: ["assets"],
        }).catch((error) => onError(error.message));
    });
  }
  function render() {
    if (!snapshotOnly) loop?.request();
  }
  const framePreview = createMapFramePreview(camera, render);
  const areaPreview = createMapAreaPreview(gpu, assets, render);
  const presentFrame = createMapFramePresentation({
    outline,
    scene,
    camera,
    annotations,
    preview,
    objectPreview,
    tiles,
    lighting,
    framePreview,
    canvas: gpu.domElement,
    objectLayer,
    profiler,
    effects,
  });
  loop = createMapFrameLoop({
    transitions,
    modelTransitions,
    preview,
    objectPreview,
    tiles,
    objectMotion,
    objectLayer,
    loadingPreview,
    volumeFog,
    lighting,
    effects,
    water,
    scene,
    camera,
    presentFrame,
    profiler,
    getCurrent: () => ({
      objects,
      options: runtime.options,
      appearance: runtime.appearance,
    }),
  });
  for (const root of [tiles.root, preview.root]) profiler.tag(root, "tiles");
  profiler.tag(objects, "objects");
  profiler.tag(objectPreview.root, "objects");
  profiler.tag(effects.root, "effects");
  for (const root of [
    annotations.root,
    loadingPreview.root,
    anchors.root,
    surfaceAnchors.root,
    ...lighting.excluded,
  ])
    profiler.tag(root, "overlays");
  const view = mapCamera(camera, gpu, host, render);
  const structure = structureView(assets, view);
  const assetView = createAssetView(camera, assets);
  const selection = createSceneSelection(
    outline,
    annotations,
    lighting,
    preview,
  );
  function updateSelection(opts = runtime.options) {
    runtime.options = { ...opts };
    if (runtime.current) {
      const next = assetView.read(runtime.options);
      if (
        next.models.size !== runtime.visibleScene?.models.size ||
        [...next.models].some((id) => !runtime.visibleScene.models.has(id)) ||
        runtime.options.selectedToken !== runtime.selectedToken
      )
        refreshVisible();
    }
    selection.update(runtime.options, view.getView());
    render();
  }
  function refreshVisible() {
    if (!runtime.current) return;
    scene.userData.outlineRevision++;
    runtime.visibleScene = assetView.read(runtime.options);
    runtime.selectedToken = runtime.options.selectedToken;
    const placed = runtime.placedTiles.filter((tile) =>
      runtime.visibleScene.tiles.has(tile.id),
    );
    const objectsInView = runtime.posedObjects.filter(
      (object) =>
        runtime.visibleScene.objects.has(object.id) ||
        runtime.renderObjects.includes(object.id),
    );
    assets.progressive(
      runtime.visibleScene.models,
      runtime.tier,
      runtime.movingIds,
      runtime.current.lightingEnabled,
      runtime.modelIds,
      runtime.options.forceLod ? "lod" : "render",
    );
    modelTransitions.ready((id) => !!modelVisual(assets, id, runtime.tier));
    tiles.rebuild(
      placed,
      runtime.tier,
      preview.hiddenIds(),
      runtime.appearance.tileOpacity,
      runtime.appearance.tileGroup,
    );
    objectLayer.update(
      {
        ...runtime.current,
        objects: objectsInView.filter(
          (o) => o.id !== runtime.scenePreviewOptions.previewObject?.id,
        ),
      },
      runtime.state && { ...runtime.state, tokens: runtime.posedTokens },
      { ...runtime.options, renderObjects: runtime.renderObjects },
      runtime.tier,
      runtime.appearance,
    );
    loadingPreview.update(runtime.scenePreviewOptions, assets.catalogue(), {
      tiles: placed.filter((t) => !preview.hiddenIds().includes(t.id)),
      objects: objectsInView.filter(
        (o) => o.id !== runtime.scenePreviewOptions.previewObject?.id,
      ),
      tier: runtime.tier,
      tileOpacity: runtime.appearance.tileOpacity,
      objectOpacity: runtime.appearance.objectOpacity,
      tileGroup: runtime.appearance.tileGroup,
    });
    water.update([tiles.root, preview.root, objects, objectPreview.root]);
    assets.prune();
  }
  const queries = mapScreenQueries(
    host,
    view,
    assets,
    preview,
    tiles,
    structure,
    () => runtime.current,
    () => runtime.tier,
    () => runtime.appearance.hiddenTiles,
  );
  const synchronizer = createSceneSynchronizer({
    runtime,
    modelTransitions,
    transitions,
    structure,
    view,
    assetView,
    objects,
    queries,
    annotations,
    assets,
    profiler,
    volumeFog,
    fog,
    preview,
    objectMotion,
    objectPreview,
    areaPreview,
    surfaceAnchors,
    anchors,
    lighting,
    effects,
    water,
    selection,
    lightSources,
    refreshVisible,
    render,
    isDead: () => dead,
  });
  const update = synchronizer.update;
  function changeCamera(next) {
    const old = runtime.tier;
    view.update(next);
    runtime.tier = modelTier(
      view.getView().cellPixels,
      runtime.tier,
      runtime.options.forceLod,
    );
    lighting.selection(runtime.options, view.getView());
    if (
      runtime.current &&
      (old !== runtime.tier ||
        assetView.read(runtime.options).key !== runtime.visibleScene?.key)
    ) {
      refreshVisible();
      selection.document(
        runtime.current,
        runtime.placedTiles,
        runtime.appearance,
        runtime.tier,
      );
      selection.update(runtime.options, view.getView());
    }
  }
  const observer = new ResizeObserver(() => {
    view.update();
    if (runtime.current)
      update(runtime.current, runtime.state, runtime.options).catch((error) =>
        onError(error.message),
      );
  });
  if (!snapshotOnly) observer.observe(host);
  return {
    update,
    updateSelection,
    setActive(value) {
      active = value;
      if (!snapshotOnly) loop.setActive(value);
    },
    observeLightFrame: framePreview.observe,
    observeAreaFrame: areaPreview.observe,
    retry() {
      assets.retryFailed();
      return update(runtime.current, runtime.state, runtime.options);
    },
    snapshot: createMapSnapshot({
      runtime,
      assets,
      update,
      tiles,
      objectMotion,
      objects,
      lighting,
      objectPreview,
      effects,
      water,
      volumeFog,
      scene,
      camera,
      gpu,
    }),
    observePerformance: profiler.observe,
    camera: changeCamera,
    getView: view.getView,
    world: view.world,
    placementPoint: structure.point,
    ...queries,
    lightPoint(event) {
      const ray = view.ray(event),
        hits = visibleSceneHits(ray, [tiles.root, objects], runtime.appearance);
      const hit = hits[0];
      return hit
        ? { x: hit.point.x, y: hit.point.z, elevation: hit.point.y }
        : { ...view.world(event, 0), elevation: 0 };
    },
    pick: (event) =>
      pickMapScene(event, {
        view,
        tiles,
        loadingPreview,
        preview,
        lighting,
        effects,
        surfaceAnchors,
        anchors,
        objects,
        appearance: runtime.appearance,
      }),
    destroy() {
      cancelAnimationFrame(assetFrame);
      dead = true;
      synchronizer.destroy();
      observer.disconnect();
      loop.destroy();
      profiler.destroy();
      annotations.destroy();
      objectLayer.destroy();
      tokenPortraits.destroy();
      tiles.destroy();
      preview.destroy();
      objectPreview.destroy();
      objectMotion.destroy();
      loadingPreview.destroy();
      anchors.destroy();
      surfaceAnchors.destroy();
      outline.destroy();
      transitions.destroy();
      modelTransitions.destroy();
      volumeFog.destroy();
      fog.destroy();
      lighting.destroy();
      effects.destroy();
      areaPreview.destroy();
      assets.destroy();
      framePreview.destroy();
      gpu.dispose();
      gpu.domElement.remove();
    },
  };
}
