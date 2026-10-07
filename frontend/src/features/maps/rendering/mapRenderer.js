import { createMapLighting } from "./mapLighting";
import { sessionMapDocument } from "../lib/sessionMapPresentation";
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
import { buildAnnotations, disposeAnnotations } from "./annotations";
import { buildSceneObjects, disposeObjects } from "./sceneObjects";
import { mapCamera } from "./mapCamera";
import { createTilePreview } from "./tilePreview";
import { createTileOutline } from "./tileOutline";
import { structureView } from "./structureView";
import { createObjectPreview } from "./objectPreview";
import { createPlacementAnchors } from "./placementAnchors";

export async function createMapRenderer(host, onError, onPreviewLoading) {
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
    current,
    options = {},
    state,
    tier = "render",
    tileKey = "",
    objectKey = "",
    fogKey = "",
    annotationKey = "",
    lastFrame = 0,
    frame = 0,
    flickerTimer = 0,
    placedTiles = [];
  let annotations = new Group(),
    objects = new Group();
  let appearance = areaAppearance({ areas: [] });
  scene.add(annotations, objects);
  const assets = modelAssets(onError, gpu),
    lighting = createMapLighting(scene, gpu, assets),
    loadingPreview = createLoadingPreview(assets, onPreviewLoading),
    fog = createMapFog(),
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
        [...appearance.hiddenTiles],
        appearance.tileOpacity,
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
  function render() {
    if (frame || dead) return;
    frame = requestAnimationFrame((time) => {
      frame = 0;
      if (dead) return;
      const elapsed = time - lastFrame || 16,
        delta = Math.min(32, elapsed);
      const moving =
        preview.advance(delta) |
        objectPreview.advance(delta) |
        tiles.advance(delta) |
        objectMotion.advance(delta, objects) |
        loadingPreview.advance(delta);
      const flickering = lighting.advance(
        Math.min(250, elapsed),
        (id) => preview.transform(id) || tiles.transform(id),
        objects,
        objectPreview.root,
      );
      lastFrame = time;
      gpu.render(scene, camera);
      for (const object of objects.children) {
        object.userData.outlineType = "object";
        object.userData.outlineStyle =
          object.userData.objectId === options.selectedObject ||
          options.selectedObjects?.includes(object.userData.objectId)
            ? "selected"
            : "hover";
      }
      outline.render(
        scene,
        camera,
        annotations,
        [
          preview.root,
          objectPreview.root,
          ...objects.children.filter(
            (o) =>
              options.master &&
              o.userData.objectId &&
              [
                ...(options.selectedObjects || []),
                options.selectedObject,
                options.hoveredObject,
              ].includes(o.userData.objectId),
          ),
        ],
        tiles.transform,
        lighting.excluded,
      );
      if (moving) render();
      else if (flickering && !flickerTimer)
        flickerTimer = setTimeout(() => {
          flickerTimer = 0;
          render();
        }, 100);
    });
  }
  const view = mapCamera(camera, gpu, host, render);
  const structure = structureView(assets, view);
  async function update(d, nextState, opts = {}) {
    const id = ++epoch;
    current = d;
    d = sessionMapDocument(d, nextState);
    state = nextState;
    options = opts;
    appearance = areaAppearance(d, opts.areaMode);
    structure.hideTiles(appearance.hiddenTiles);
    view.document(d, opts);
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
    const pending = ids.size
      ? assets.ensure(ids, tier, opts)
      : Promise.resolve();
    const previewPending = movingIds.size
      ? assets.ensure(movingIds, "render", opts)
      : Promise.resolve();
    const shadowPending =
      d.lightingEnabled && (ids.size || movingIds.size)
        ? assets.ensure(new Set([...ids, ...movingIds]), "shadow", opts)
        : Promise.resolve();
    // Start rendering the preview immediately; network loading does not block it.
    const readyMetadata = d.tiles.every((t) => assets.metadata(t.modelId));
    if (readyMetadata) structure.update(d);
    const loadingOptions = {
      ...opts,
      previewTile: opts.previewTile && {
        ...opts.previewTile,
        group: readyMetadata
          ? structure.preview(opts.previewTile.group || [opts.previewTile])
          : opts.previewTile.group,
      },
    };
    loadingPreview.update(loadingOptions, opts.catalogue || assets.catalogue());
    render();
    await Promise.all([pending, previewPending, shadowPending]);
    if (dead || id !== epoch) return;
    loadingPreview.update(opts, opts.catalogue || assets.catalogue());
    const placed = structure.update(d);
    placedTiles = placed;
    view.document(d, { ...opts, sceneHeight: structure.top() });
    const nextTier = view.getView().cellPixels < 72 ? "lod" : "render";
    if (nextTier !== tier && ids.size) {
      tier = nextTier;
      await assets.ensure(ids, tier, opts);
      if (dead || id !== epoch) return;
    }
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
    preview.update(previewOptions.previewTile, placed);
    const posedObjects = d.objects.map((o) =>
      resolvedSurfacePosition(o, d, assets.catalogue(), structure.context()),
    );
    objectMotion.update(posedObjects, d);
    const posedTokens = (nextState?.tokens || [])
      .filter(
        (t) => opts.master || !appearance.hiddenTiles.has(t.placement?.tileId),
      )
      .map((t) =>
        resolvedSurfacePosition(t, d, assets.catalogue(), structure.context()),
      );
    objectPreview.update(
      opts.previewObject &&
        resolvedSurfacePosition(
          opts.previewObject,
          d,
          assets.catalogue(),
          structure.context(),
        ),
    );
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
    const hiddenIds = [
      ...new Set([...preview.hiddenIds(), ...appearance.hiddenTiles]),
    ];
    const nextTiles = JSON.stringify([
      d.tiles,
      tier,
      hiddenIds,
      d.areas,
      opts.areaMode,
    ]);
    if (nextTiles !== tileKey) {
      tileKey = nextTiles;
      tiles.rebuild(placed, tier, hiddenIds, appearance.tileOpacity);
    }
    outline.update(
      { ...d, tiles: placed.filter((t) => !appearance.hiddenTiles.has(t.id)) },
      {
        ...previewOptions,
        selectedTiles: (opts.selectedTiles || []).filter(
          (id) => !hiddenIds.includes(id),
        ),
        selectedTile: hiddenIds.includes(opts.selectedTile)
          ? ""
          : opts.selectedTile,
        hoveredTile: hiddenIds.includes(opts.hoveredTile)
          ? ""
          : opts.hoveredTile,
      },
      tier,
    );
    const nextObjects = JSON.stringify([
      posedObjects,
      nextState,
      posedTokens,
      tier,
      opts.master,
      opts.selectedToken,
      opts.previewObject?.id,
      renderObjects,
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
          objects: posedObjects.filter(
            (o) =>
              o.id !== opts.previewObject?.id &&
              !appearance.hiddenObjects.has(o.id),
          ),
        },
        nextState && { ...nextState, tokens: posedTokens },
        {
          ...opts,
          invalidate: render,
          renderObjects,
          areaObjectOpacity: appearance.objectOpacity,
        },
        fog,
        assets,
        tier,
      );
      scene.add(objects);
    }
    const nextAnnotations = JSON.stringify([
      d.width,
      d.height,
      d.kind,
      d.grid,
      d.zones,
      opts.master,
      opts.showZones,
      opts.selectedZone,
      opts.selection,
      nextTiles,
    ]);
    if (nextAnnotations !== annotationKey) {
      annotationKey = nextAnnotations;
      scene.remove(annotations);
      disposeAnnotations(annotations);
      annotations = buildAnnotations(d, opts);
      scene.add(annotations);
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
    );
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
  return {
    update,
    snapshot() {
      tiles.advance(1000);
      objectMotion.advance(1000, objects);
      lighting.advance(
        0,
        (id) => tiles.transform(id),
        objects,
        objectPreview.root,
      );
      gpu.render(scene, camera);
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
        hits = [
          ...ray.intersectObject(tiles.root, true),
          ...ray.intersectObject(objects, true),
        ].sort((a, b) => a.distance - b.distance);
      const hit = hits[0];
      return hit
        ? { x: hit.point.x, y: hit.point.z, elevation: hit.point.y }
        : { ...view.world(event, 0), elevation: 0 };
    },
    pick(event) {
      const ray = view.ray(event),
        hits = ray.intersectObject(objects, true),
        fixed = tiles.hit(ray),
        moving = preview.hit(ray),
        tile =
          moving && (!fixed || moving.distance < fixed.distance)
            ? moving
            : fixed;
      const lamp = lighting.pick(ray);
      if (lamp) return lamp;
      const surfaceAnchor = surfaceAnchors.hit(ray);
      if (surfaceAnchor) return surfaceAnchor;
      const anchor = anchors.hit(ray);
      if (
        anchor &&
        (!tile || anchor.distance < tile.distance) &&
        (!hits[0] || anchor.distance < hits[0].distance)
      )
        return anchor;
      for (const hit of hits) {
        if (tile && tile.distance < hit.distance) return tile;
        let node = hit.object;
        while (node) {
          if (node.userData.objectId)
            return { objectId: node.userData.objectId };
          if (node.userData.tokenId) return { tokenId: node.userData.tokenId };
          node = node.parent;
        }
      }
      return tile;
    },
    destroy() {
      dead = true;
      epoch++;
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(flickerTimer);
      disposeAnnotations(annotations);
      disposeObjects(objects);
      tiles.destroy();
      preview.destroy();
      objectPreview.destroy();
      objectMotion.destroy();
      loadingPreview.destroy();
      anchors.destroy();
      surfaceAnchors.destroy();
      outline.destroy();
      fog.destroy();
      lighting.destroy();
      assets.destroy();
      gpu.dispose();
      gpu.domElement.remove();
    },
  };
}
