import { areaAppearance } from "../lib/mapAreas";
import { resolvedSurfacePosition } from "../lib/surfacePlacement";
import { tokenItemIds, tokenModelId } from "../lib/tokenModels";
import { tokenVisualModels } from "../lib/tokenBases";
import { modelTier } from "./modelTier";

export function createSceneSynchronizer({
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
  isDead,
}) {
  let epoch = 0,
    structureDirty = true,
    fogKey = "";
  async function update(d, nextState, opts = {}) {
    const id = ++epoch;
    structureDirty ||=
      !opts.sceneChanges || opts.sceneChanges.includes("structure");
    if (
      !opts.sceneChanges ||
      opts.sceneChanges.some((kind) =>
        ["structure", "entities", "visibility"].includes(kind),
      )
    )
      queries.invalidate();
    runtime.current = d;
    runtime.state = nextState;
    runtime.options = opts;
    modelTransitions.sync(d.tiles, opts);
    transitions.sync(d, opts);
    runtime.appearance = modelTransitions.appearance(
      areaAppearance(d, opts.areaMode, transitions),
    );
    structure.hideTiles(runtime.appearance.hiddenTiles);
    view.document(d, opts);
    annotations.update(d, opts);
    render();
    runtime.tier = modelTier(
      view.getView().cellPixels,
      runtime.current === d && runtime.placedTiles.length ? runtime.tier : null,
      opts.forceLod,
    );
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
    runtime.renderObjects = d.objects
      .filter((o) => movingParents.has(o.placement?.tileId))
      .map((o) => o.id);
    for (const object of d.objects)
      if (runtime.renderObjects.includes(object.id) && object.modelId)
        objectIds.add(object.modelId);
    if (opts.placementObject) objectIds.add(opts.placementObject);
    runtime.movingIds = new Set([...previewIds, ...objectIds]);
    runtime.modelIds = ids;
    await assets.prepare(new Set([...ids, ...runtime.movingIds]), {
      ...opts,
      itemIds: tokenItemIds(nextState?.tokens),
    });
    if (isDead() || id !== epoch) return;
    opts = { ...opts, ...runtime.options };
    runtime.options = opts;
    const catalogue = assets.catalogue();
    runtime.tokenModels = new Map(
      (nextState?.tokens || []).map((t) => [t.id, tokenModelId(t, catalogue)]),
    );
    for (const modelId of runtime.tokenModels.values())
      if (modelId) runtime.modelIds.add(modelId);
    for (const token of nextState?.tokens || [])
      for (const model of tokenVisualModels(token, nextState, catalogue))
        runtime.modelIds.add(model.modelId);
    const updateStarted = profiler.updateStart();
    const placed = structure.update(d, structureDirty);
    structureDirty = false;
    runtime.placedTiles = placed;
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
    runtime.tier = modelTier(
      view.getView().cellPixels,
      runtime.current === d && runtime.placedTiles.length ? runtime.tier : null,
      opts.forceLod,
    );
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
      runtime.appearance.hiddenObjects.has(opts.previewObject.id)
    )
      previewOptions = { ...previewOptions, previewObject: null };
    const detailTier = opts.forceLod ? "lod" : "render";
    preview.update(previewOptions.previewTile, placed, detailTier);
    runtime.posedObjects = d.objects.map((o) =>
      resolvedSurfacePosition(o, d, assets.catalogue(), structure.context()),
    );
    runtime.posedTokens = (nextState?.tokens || []).map((t) =>
      resolvedSurfacePosition(t, d, assets.catalogue(), structure.context()),
    );
    objectMotion.update(
      [
        ...runtime.posedObjects,
        ...runtime.posedTokens.map((t) => ({
          ...t,
          elevation: t.elevation + 0.05,
        })),
      ],
      d,
    );
    objectPreview.update(
      opts.previewObject &&
        !runtime.appearance.hiddenObjects.has(opts.previewObject.id) &&
        resolvedSurfacePosition(
          opts.previewObject,
          d,
          assets.catalogue(),
          structure.context(),
        ),
      detailTier,
    );
    areaPreview.update(d, placed, runtime.posedObjects);
    surfaceAnchors.update(
      d,
      assets.catalogue(),
      opts.previewObject,
      !!opts.placementObject ||
        !!opts.surfacePlacement ||
        (!!opts.previewObject?.modelId &&
          (!!opts.previewObject?.placing || !!opts.previewObject?.moving)),
      runtime.appearance.hiddenTiles,
    );
    const context = structure.context();
    anchors.update(
      d,
      {
        ...context,
        sockets: new Map(
          [...context.sockets].filter(
            ([, slot]) => !runtime.appearance.hiddenTiles.has(slot.parent),
          ),
        ),
      },
      opts,
    );
    runtime.scenePreviewOptions = previewOptions;
    assetView.update(
      placed,
      runtime.posedObjects,
      runtime.posedTokens.flatMap((t) => tokenVisualModels(t, nextState, catalogue)),
    );
    refreshVisible();
    selection.document(d, placed, runtime.appearance, runtime.tier);
    selection.update(previewOptions, view.getView());
    lightSources.update(
      d,
      previewOptions,
      structure.context(),
      placed,
      runtime.posedObjects,
    );
    lighting.update(
      d,
      { ...previewOptions, sceneHeight: structure.top() },
      structure.context(),
      placed,
      [
        ...runtime.posedObjects,
        ...runtime.posedTokens
          .filter(
            (t) =>
              runtime.tokenModels.get(t.id) &&
              runtime.appearance.tokenOpacity(t.placement?.tileId) > 0.001,
          )
          .flatMap((t) => tokenVisualModels(t, nextState, catalogue)),
      ],
      view.getView(),
      objects,
      objectPreview.root,
      runtime.appearance,
    );
    effects.update(
      d,
      previewOptions,
      structure.context(),
      placed,
      runtime.posedObjects,
      runtime.appearance,
    );
    profiler.updateEnd(updateStarted);
    render();
  }
  return {
    update,
    destroy() {
      epoch++;
    },
  };
}
