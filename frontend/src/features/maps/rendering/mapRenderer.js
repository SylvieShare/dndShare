import { createAreaTransitions } from "./areaTransitions";
import { createMapFrameLoop } from "./mapFrameLoop";
import { createRenderProfiler } from "./renderProfiler";
import { createMapFramePresentation } from "./mapFramePresentation";
import { createVolumeFog } from "./volumeFogRenderer";
import { pickMapScene, visibleSceneHits } from "./mapScenePicking";
import { createMapAreaPreview } from "./mapAreaPreview";
import { createMapFramePreview } from "./mapFramePreview";
import { startModelRefresh } from "../lib/currentModelRefresh";
import { getMapModels } from "@/shared/api/mapsApi";
import { createMapLighting } from "./mapLighting";
import { createMapEffects } from "./mapEffects";
import { areaAppearance } from "../lib/mapAreas";
import { mapScreenQueries } from "./mapScreenQueries";
import { createLoadingPreview } from "./loadingPreview";
import { createObjectMotion } from "./objectMotion";
import { objectPlacementAnchors } from "./objectPlacementAnchors";
import { resolvedSurfacePosition } from "../lib/surfacePlacement";
import {
  ACESFilmicToneMapping,
  Color,
  Group,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { modelAssets } from "./modelAssets";
import { createMapFog } from "./mapFog";
import { createTileLayer } from "./tileLayer";
import { createMapAnnotations } from "./mapAnnotations";
import { buildSceneObjects, disposeObjects } from "./sceneObjects";
import { createTokenPortraits } from "./sceneTokens";
import { mapCamera } from "./mapCamera";
import { createTilePreview } from "./tilePreview";
import { createTileOutline } from "./tileOutline";
import { structureView } from "./structureView";
import { createObjectPreview } from "./objectPreview";
import { createPlacementAnchors } from "./placementAnchors";

export async function createMapRenderer(
  host,
  onError,
  onPreviewLoading,
  onDownloadProgress,
) {
  const gpu = new WebGLRenderer({ antialias: true });
  gpu.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  gpu.toneMapping = ACESFilmicToneMapping;
  gpu.toneMappingExposure = 1;
  const scene = new Scene();
  scene.background = new Color(0x161b23);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 2000);
  host.appendChild(gpu.domElement);
  let dead = false,
    epoch = 0,
    assetFrame = 0,
    current,
    options = {},
    state,
    tier = "render",
    tileKey = "",
    objectKey = "",
    fogKey = "",
    loop,
    placedTiles = [];
  let objects = new Group();
  const profiler = createRenderProfiler(gpu, render);
  const annotations = createMapAnnotations(scene);
  let appearance = areaAppearance({ areas: [] });
  scene.add(objects);
  const assets = modelAssets(onError, gpu, assetsChanged, onDownloadProgress),
    lighting = createMapLighting(scene, gpu, assets, assetsChanged),
    loadingPreview = createLoadingPreview(assets, onPreviewLoading),
    fog = createMapFog(),
    effects = createMapEffects(scene, fog, assets, render),
    transitions = createAreaTransitions(assetsChanged),
    volumeFog = createVolumeFog(gpu, fog.uniforms, transitions),
    tokenPortraits = createTokenPortraits(render),
    tiles = createTileLayer(assets, fog),
    objectMotion = createObjectMotion(
      assets,
      (id) => preview.transform(id) || tiles.transform(id),
    ),
    preview = createTilePreview(assets, () => {
      tileKey = "";
      tiles.rebuild(
        placedTiles,
        tier,
        [],
        appearance.tileOpacity,
        appearance.tileGroup,
      );
      if (current)
        outline.update(
          {
            ...current,
            tiles: placedTiles.filter((t) => !appearance.hiddenTiles.has(t.id)),
          },
          options,
          tier,
        );
    }),
    outline = createTileOutline(gpu, assets),
    objectPreview = createObjectPreview(fog, assets),
    surfaceAnchors = objectPlacementAnchors(),
    anchors = createPlacementAnchors();
  scene.add(
    tiles.root,
    loadingPreview.root,
    preview.root,
    objectPreview.root,
    anchors.root,
    surfaceAnchors.root,
  );
  function assetsChanged() {
    if (dead || assetFrame || !current) return;
    assetFrame = requestAnimationFrame(() => {
      assetFrame = 0;
      if (!dead && current)
        update(current, state, options).catch((error) =>
          onError(error.message),
        );
    });
  }
  function render() {
    loop?.request();
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
  });
  loop = createMapFrameLoop({
    transitions,
    preview,
    objectPreview,
    tiles,
    objectMotion,
    loadingPreview,
    volumeFog,
    lighting,
    effects,
    scene,
    camera,
    presentFrame,
    profiler,
    getCurrent: () => ({ objects, options, appearance }),
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
  async function update(d, nextState, opts = {}) {
    const id = ++epoch;
    current = d;
    state = nextState;
    options = opts;
    transitions.sync(d, opts);
    appearance = areaAppearance(d, opts.areaMode, transitions);
    structure.hideTiles(appearance.hiddenTiles);
    view.document(d, opts);
    annotations.update(d, opts);
    render();
    tier = view.getView().cellPixels < 72 ? "lod" : "render";
    const ids = new Set([
      ...d.tiles.map((t) => t.modelId),
      ...d.objects.map((o) => o.modelId).filter(Boolean),
    ]);

    const previewIds = preview.modelIds();
    if (opts.previewTile)
      for (const tile of opts.previewTile.group || [opts.previewTile])
        previewIds.add(tile.modelId);
    const objectIds = new Set(
      (
        opts.previewObject?.group ||
        (opts.previewObject ? [opts.previewObject] : [])
      )
        .map((o) => o.modelId)
        .filter(Boolean),
    );
    const movingParents = new Set(
      opts.previewTile?.tileIds || preview.hiddenIds(),
    );
    const renderObjects = d.objects
      .filter((o) => movingParents.has(o.placement?.tileId))
      .map((o) => o.id);
    for (const object of d.objects)
      if (renderObjects.includes(object.id) && object.modelId)
        objectIds.add(object.modelId);
    if (opts.placementObject) objectIds.add(opts.placementObject);
    const movingIds = new Set([...previewIds, ...objectIds]);
    await assets.prepare(new Set([...ids, ...movingIds]), opts);
    if (dead || id !== epoch) return;
    const updateStarted = profiler.updateStart();
    const placed = structure.update(d);
    placedTiles = placed;
    let previewOptions = opts;
    if (opts.previewTile) {
      const group = structure.preview(
        opts.previewTile.group || [opts.previewTile],
      );
      previewOptions = {
        ...opts,
        previewTile: {
          ...opts.previewTile,
          elevation: (
            group.find((t) => t.id === opts.previewTile.tileId) || group[0]
          ).elevation,
          group,
        },
      };
    }
    volumeFog.update(
      d,
      placed,
      assets.catalogue(),
      previewOptions.previewTile?.group,
    );
    view.document(d, {
      ...opts,
      sceneHeight: structure.top(),
    });
    tier = view.getView().cellPixels < 72 ? "lod" : "render";
    assets.progressive(ids, tier, movingIds, d.lightingEnabled);
    const nextFog = JSON.stringify([
      d.width,
      d.height,
      d.zones,
      d.grid,
      nextState?.fog,
      nextState?.defaultVisibility,
      nextState?.zones,
      opts.master,
    ]);
    if (nextFog !== fogKey) {
      fogKey = nextFog;
      fog.update(d, nextState, opts.master);
    }
    if (
      opts.previewObject &&
      appearance.hiddenObjects.has(opts.previewObject.id)
    )
      previewOptions = { ...previewOptions, previewObject: null };
    preview.update(previewOptions.previewTile, placed);
    const posedObjects = d.objects.map((o) =>
      resolvedSurfacePosition(o, d, assets.catalogue(), structure.context()),
    );
    const posedTokens = (nextState?.tokens || []).map((t) =>
      resolvedSurfacePosition(t, d, assets.catalogue(), structure.context()),
    );
    objectMotion.update(
      [
        ...posedObjects,
        ...posedTokens.map((t) => ({
          ...t,
          rotation: 0,
          elevation: t.elevation + 0.05,
        })),
      ],
      d,
    );
    objectPreview.update(
      opts.previewObject &&
        !appearance.hiddenObjects.has(opts.previewObject.id) &&
        resolvedSurfacePosition(
          opts.previewObject,
          d,
          assets.catalogue(),
          structure.context(),
        ),
    );
    areaPreview.update(d, placed, posedObjects);
    surfaceAnchors.update(
      d,
      assets.catalogue(),
      opts.previewObject,
      !!opts.placementObject ||
        !!opts.surfacePlacement ||
        (!!opts.previewObject?.modelId &&
          (!!opts.previewObject?.placing || !!opts.previewObject?.moving)),
      appearance.hiddenTiles,
    );
    loadingPreview.update(previewOptions, assets.catalogue(), {
      tiles: placed.filter((t) => !preview.hiddenIds().includes(t.id)),
      objects: posedObjects.filter((o) => o.id !== opts.previewObject?.id),
      tier,
      tileOpacity: appearance.tileOpacity,
      objectOpacity: appearance.objectOpacity,
      tileGroup: appearance.tileGroup,
    });
    const context = structure.context();
    anchors.update(
      d,
      {
        ...context,
        sockets: new Map(
          [...context.sockets].filter(
            ([, slot]) => !appearance.hiddenTiles.has(slot.parent),
          ),
        ),
      },
      opts,
    );
    const hiddenIds = preview.hiddenIds();
    const hiddenSelection = new Set([...hiddenIds, ...appearance.hiddenTiles]);
    const catalogueStamp = [...ids]
      .sort()
      .map((modelId) => assets.metadata(modelId));
    const visualStamp = assets.signature(ids, tier);
    const nextTiles = JSON.stringify([
      catalogueStamp,
      visualStamp,
      d.tiles,
      tier,
      hiddenIds,
      d.areas,
      opts.areaMode,
    ]);
    if (nextTiles !== tileKey) {
      tileKey = nextTiles;
      tiles.rebuild(
        placed,
        tier,
        hiddenIds,
        appearance.tileOpacity,
        appearance.tileGroup,
      );
    }
    outline.update(
      { ...d, tiles: placed.filter((t) => !appearance.hiddenTiles.has(t.id)) },
      {
        ...previewOptions,
        selectedTiles: (opts.selectedTiles || []).filter(
          (id) => !hiddenSelection.has(id),
        ),
        selectedTile: hiddenSelection.has(opts.selectedTile)
          ? ""
          : opts.selectedTile,
        hoveredTile: hiddenSelection.has(opts.hoveredTile)
          ? ""
          : opts.hoveredTile,
      },
      tier,
    );
    const nextObjects = JSON.stringify([
      catalogueStamp,
      visualStamp,
      posedObjects,
      nextState,
      posedTokens,
      tier,
      opts.master,
      opts.selectedToken,
      opts.previewObject?.id,
      renderObjects,
      assets.signature(
        new Set(
          posedObjects
            .filter((o) => renderObjects.includes(o.id))
            .map((o) => o.modelId)
            .filter(Boolean),
        ),
        "render",
      ),
      d.areas,
      opts.areaMode,
    ]);
    if (nextObjects !== objectKey) {
      objectKey = nextObjects;
      scene.remove(objects);
      disposeObjects(objects);
      objects = buildSceneObjects(
        {
          ...d,
          objects: posedObjects.filter((o) => o.id !== opts.previewObject?.id),
        },
        nextState && { ...nextState, tokens: posedTokens },
        {
          ...opts,
          tokenPortraits,
          renderObjects,
          areaObjectOpacity: appearance.objectOpacity,
          areaTileOpacity: appearance.tokenOpacity,
        },
        fog,
        assets,
        tier,
      );
      scene.add(objects);
      profiler.tag(objects, "objects");
    }
    lighting.update(
      d,
      { ...previewOptions, sceneHeight: structure.top() },
      structure.context(),
      placed,
      posedObjects,
      view.getView(),
      objects,
      objectPreview.root,
      appearance,
    );
    effects.update(
      d,
      previewOptions,
      structure.context(),
      placed,
      posedObjects,
      appearance,
    );
    assets.prune();
    profiler.updateEnd(updateStarted);
    render();
  }
  function changeCamera(next) {
    const old = tier;
    view.update(next);
    tier = view.getView().cellPixels < 72 ? "lod" : "render";
    if (current && old !== tier)
      update(current, state, options).catch((error) => onError(error.message));
  }
  const observer = new ResizeObserver(() => {
    view.update();
    if (current)
      update(current, state, options).catch((error) => onError(error.message));
  });
  observer.observe(host);
  const stopModelRefresh = startModelRefresh(
    () =>
      current && !options.catalogue ? getMapModels(options.publicCode) : null,
    async (models) => {
      assets.replaceCatalogue(models);
      await update(current, state, options);
    },
  );
  return {
    update,
    observeLightFrame: framePreview.observe,
    observeAreaFrame: areaPreview.observe,
    retry() {
      assets.retryFailed();
      return update(current, state, options);
    },
    async snapshot() {
      const ids = new Set([
        ...current.tiles.map((t) => t.modelId),
        ...current.objects.map((o) => o.modelId).filter(Boolean),
      ]);
      await assets.ensure(ids, tier, options);
      if (current.lightingEnabled) await assets.ensure(ids, "shadow", options);
      await update(current, state, options);

      tiles.advance(1000);
      objectMotion.advance(1000, objects);
      lighting.advance(
        0,
        (id) => tiles.transform(id),
        objects,
        objectPreview.root,
      );
      effects.advance(
        0,
        1000,
        (id) => tiles.transform(id),
        objects,
        objectPreview.root,
      );
      volumeFog.render(scene, camera);
      return new Promise((resolve, reject) =>
        gpu.domElement.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(new Error("Не удалось создать превью карты")),
          "image/webp",
          0.88,
        ),
      );
    },
    observePerformance: profiler.observe,
    camera: changeCamera,
    getView: view.getView,
    world: view.world,
    placementPoint: structure.point,
    ...mapScreenQueries(
      host,
      view,
      assets,
      preview,
      tiles,
      structure,
      () => current,
      () => tier,
      () => appearance.hiddenTiles,
    ),
    lightPoint(event) {
      const ray = view.ray(event),
        hits = visibleSceneHits(ray, [tiles.root, objects], appearance);
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
        appearance,
      }),
    destroy() {
      cancelAnimationFrame(assetFrame);
      stopModelRefresh();
      dead = true;
      epoch++;
      observer.disconnect();
      loop.destroy();
      profiler.destroy();
      annotations.destroy();
      disposeObjects(objects);
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
