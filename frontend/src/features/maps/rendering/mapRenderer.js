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
  WebGLRenderer,
} from "three";
import { modelAssets } from "./modelAssets";
import { createMapFog } from "./mapFog";
import { createTileLayer } from "./tileLayer";
import { buildAnnotations, disposeAnnotations, FLOOR } from "./annotations";
import { buildSceneObjects, disposeObjects } from "./sceneObjects";
import { mapCamera } from "./mapCamera";

export async function createMapRenderer(host, onError) {
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
    frame = 0;
  let annotations = new Group(),
    objects = new Group(),
    background = new Group();
  scene.add(annotations, objects, background);
  const assets = modelAssets(onError),
    fog = createMapFog(),
    tiles = createTileLayer(assets, fog);
  scene.add(tiles.root);
  function render() {
    if (frame || dead) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!dead) gpu.render(scene, camera);
    });
  }
  const view = mapCamera(camera, gpu, host, render);
  async function update(d, nextState, opts = {}) {
    const id = ++epoch;
    current = d;
    state = nextState;
    options = opts;
    view.document(d, opts);
    tier = view.getView().cellPixels < 72 ? "lod" : "render";
    const ids = new Set(d.tiles.map((t) => t.modelId));
    if (opts.previewTile) ids.add(opts.previewTile.modelId);
    if (ids.size) await assets.ensure(ids, tier, opts);
    if (dead || id !== epoch) return;
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
    const nextTiles = JSON.stringify([d.tiles, tier, opts.previewTile]);
    if (nextTiles !== tileKey) {
      tileKey = nextTiles;
      tiles.rebuild(d.tiles, tier, opts.previewTile);
    }
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
    scene.remove(annotations);
    disposeAnnotations(annotations);
    annotations = buildAnnotations(d, opts, (id) => assets.metadata(id));
    scene.add(annotations);
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
  return {
    update,
    camera: changeCamera,
    getView: view.getView,
    world: view.world,
    pick(event) {
      const ray = view.ray(event),
        hits = ray.intersectObject(objects, true);
      for (const hit of hits) {
        let node = hit.object;
        while (node) {
          if (node.userData.objectId)
            return { objectId: node.userData.objectId };
          if (node.userData.tokenId) return { tokenId: node.userData.tokenId };
          node = node.parent;
        }
      }
      return tiles.hit(ray);
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
      fog.destroy();
      assets.destroy();
      gpu.dispose();
      gpu.domElement.remove();
    },
  };
}
