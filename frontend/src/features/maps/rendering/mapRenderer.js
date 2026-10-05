import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from "three";
import { modelAssets } from "./modelAssets";
import { createMapFog } from "./mapFog";
import { createTileLayer } from "./tileLayer";
import { buildAnnotations, disposeAnnotations, FLOOR } from "./annotations";
import { buildSceneObjects, disposeObjects } from "./sceneObjects";
import { mapCamera } from "./mapCamera";
import { createTilePreview } from "./tilePreview";
import { createTileOutline } from "./tileOutline";
import { tileBounds } from "./tileTransform";
import { CONNECTIONS } from "../lib/tileConnections";
import { tileSize } from "../lib/tilePlacement";
import { structureView } from "./structureView";

export async function createMapRenderer(host, onError, onFrame) {
  const gpu = new WebGLRenderer({ antialias: true });
  gpu.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  gpu.toneMapping = ACESFilmicToneMapping;
  gpu.toneMappingExposure = 1;
  const scene = new Scene();
  scene.background = new Color(0x161b23);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 2000);
  scene.add(new HemisphereLight(0xffffff, 0x625141, 2));
  const light = new DirectionalLight(0xfff2df, 3);
  light.position.set(-20, 40, -25);
  scene.add(light);
  const fill = new DirectionalLight(0xe0e8ff, 0.6);
  fill.position.set(20, 12, 25);
  scene.add(fill);
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
    backgroundKey = "",
    annotationKey = "",
    lastFrame = 0,
    frame = 0;
  let annotations = new Group(),
    objects = new Group(),
    background = new Group();
  scene.add(annotations, objects, background);
  const assets = modelAssets(onError),
    fog = createMapFog(),
    tiles = createTileLayer(assets, fog),
    preview = createTilePreview(assets),
    outline = createTileOutline(gpu, assets);
  scene.add(tiles.root, preview.root);
  function render() {
    if (frame || dead) return;
    frame = requestAnimationFrame((time) => {
      frame = 0;
      if (dead) return;
      const moving = preview.advance(Math.min(32, time - lastFrame || 16));
      lastFrame = time;
      gpu.render(scene, camera);
      outline.render(scene, camera, annotations, preview.root);
      onFrame?.();
      if (moving) render();
    });
  }
  const view = mapCamera(camera, gpu, host, render);
  const structure = structureView(assets, view);
  async function update(d, nextState, opts = {}) {
    const id = ++epoch;
    current = d;
    state = nextState;
    options = opts;
    view.document(d, opts);
    tier = view.getView().cellPixels < 72 ? "lod" : "render";
    const ids = new Set(d.tiles.map((t) => t.modelId));
    if (opts.previewTile)
      for (const tile of opts.previewTile.group || [opts.previewTile])
        ids.add(tile.modelId);
    if (ids.size) await assets.ensure(ids, tier, opts);
    if (dead || id !== epoch) return;
    const placed = structure.update(d);
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
          elevation: group[0].elevation,
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
    const nextTiles = JSON.stringify([
      d.tiles,
      tier,
      opts.previewTile?.tileIds,
    ]);
    if (nextTiles !== tileKey) {
      tileKey = nextTiles;
      tiles.rebuild(placed, tier, opts.previewTile?.tileIds);
    }
    preview.update(previewOptions.previewTile, tier);
    outline.update({ ...d, tiles: placed }, previewOptions, tier);
    const nextObjects = JSON.stringify([
      d.objects,
      nextState,
      opts.master,
      opts.selectedToken,
    ]);
    if (nextObjects !== objectKey) {
      objectKey = nextObjects;
      scene.remove(objects);
      disposeObjects(objects);
      objects = buildSceneObjects(
        d,
        nextState,
        { ...opts, invalidate: render },
        fog,
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
      opts.activeLevel,
      nextTiles,
    ]);
    if (nextAnnotations !== annotationKey) {
      annotationKey = nextAnnotations;
      scene.remove(annotations);
      disposeAnnotations(annotations);
      annotations = buildAnnotations(d, opts, structure.context());
      scene.add(annotations);
    }
    const nextBackground = JSON.stringify([
      d.kind,
      d.width,
      d.height,
      d.background,
    ]);
    if (nextBackground !== backgroundKey) {
      backgroundKey = nextBackground;
      scene.remove(background);
      disposeObjects(background);
      background = new Group();
      scene.add(background);
      if (d.kind !== "tiles" && d.background.url) {
        const key = backgroundKey;
        const url = d.background.assetId
          ? opts.publicCode
            ? `/api/public/sessions/${encodeURIComponent(opts.publicCode)}/map-background`
            : `/api/storage/images/${d.background.assetId}`
          : d.background.url;
        new TextureLoader().load(
          url,
          (texture) => {
            if (dead || backgroundKey !== key) {
              texture.dispose();
              return;
            }
            texture.colorSpace = SRGBColorSpace;
            const mesh = new Mesh(
              new PlaneGeometry(d.width, d.height),
              fog.material(new MeshBasicMaterial({ map: texture })),
            );
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(d.width / 2, FLOOR - 0.02, d.height / 2);
            background.add(mesh);
            render();
          },
          undefined,
          () => onError("Не удалось загрузить фон карты"),
        );
      }
    }
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
  function screenBounds(tile) {
    const model = assets.model(tile.modelId, tier),
      metadata = assets.metadata(tile.modelId);
    if (!model || !metadata) return null;
    const bounds = tileBounds(structure.posed(tile), metadata, model),
      points = [];
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z])
          points.push(view.project(new Vector3(x, y, z)));
    return {
      left: Math.min(...points.map((p) => p.x)),
      right: Math.max(...points.map((p) => p.x)),
      top: Math.min(...points.map((p) => p.y)),
      bottom: Math.max(...points.map((p) => p.y)),
    };
  }
  return {
    update,
    camera: changeCamera,
    getView: view.getView,
    world: view.world,
    placementPoint: structure.point,
    pick(event) {
      const ray = view.ray(event),
        hits = ray.intersectObject(objects, true),
        tile = tiles.hit(ray);
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
    connectionPoints(id) {
      const tile = current?.tiles.find((t) => t.id === id),
        metadata = tile && assets.metadata(tile.modelId);
      if (!tile || !metadata) return [];
      const b = screenBounds(tile);
      if (
        !b ||
        b.right < 0 ||
        b.left > host.clientWidth ||
        b.bottom < 0 ||
        b.top > host.clientHeight
      )
        return [];
      const size = tileSize(tile, metadata),
        elevation = structure.posed(tile).elevation;
      const points = CONNECTIONS.map((direction) =>
        view.project(
          new Vector3(
            tile.x + size.width / 2 + (direction.x * size.width) / 2,
            elevation + metadata.maxHeight + 0.15,
            tile.y + size.height / 2 + (direction.y * size.height) / 2,
          ),
        ),
      );
      const minX = Math.min(...points.map((p) => p.x)),
        maxX = Math.max(...points.map((p) => p.x)),
        minY = Math.min(...points.map((p) => p.y)),
        maxY = Math.max(...points.map((p) => p.y));
      const dx =
          minX < 26
            ? 26 - minX
            : maxX > host.clientWidth - 26
              ? host.clientWidth - 26 - maxX
              : 0,
        dy =
          minY < 26
            ? 26 - minY
            : maxY > host.clientHeight - 90
              ? host.clientHeight - 90 - maxY
              : 0;
      return points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    },
    tilesInRect(rect) {
      return (current?.tiles || [])
        .filter((tile) => {
          const b = screenBounds(tile);
          return (
            b &&
            b.right >= rect.left &&
            b.left <= rect.left + rect.width &&
            b.bottom >= rect.top &&
            b.top <= rect.top + rect.height
          );
        })
        .map((tile) => tile.id);
    },
    destroy() {
      dead = true;
      epoch++;
      observer.disconnect();
      cancelAnimationFrame(frame);
      disposeAnnotations(annotations);
      disposeObjects(objects);
      disposeObjects(background);
      tiles.destroy();
      preview.destroy();
      outline.destroy();
      fog.destroy();
      assets.destroy();
      gpu.dispose();
      gpu.domElement.remove();
    },
  };
}
