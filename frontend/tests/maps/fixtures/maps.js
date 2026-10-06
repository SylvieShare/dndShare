import { BoxGeometry, Mesh, MeshStandardMaterial, Scene } from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { createApp, h } from "vue";
import { createPinia } from "pinia";
import { createRouter, createMemoryHistory, RouterView } from "vue-router";
import { useAccountStore } from "../../../src/stores/account";
import MapLibrary from "../../../src/features/maps/components/MapLibrary.vue";
import MapEditorHeader from "../../../src/features/maps/components/MapEditorHeader.vue";
import ViewMapEditor from "../../../src/features/maps/pages/ViewMapEditor.vue";
import SessionMapWorkspace from "../../../src/features/maps/components/SessionMapWorkspace.vue";
import ViewMapScreen from "../../../src/features/maps/pages/ViewMapScreen.vue";
import {
  clone,
  newMap,
  initialState,
  paint,
  lineCells,
} from "../../../src/features/maps/lib/mapModel";
import "@sylvieshare/share-ui/styles.css";
import "../../../src/app/theme.css";
const WALL = "11111111-1111-4111-8111-111111111111",
  FLOOR = "22222222-2222-4222-8222-222222222222";
const FRAME = "77777777-7777-4777-8777-777777777777",
  BRIDGE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  PEG = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  UD_FLOOR = "88888888-8888-4888-8888-888888888888",
  UD_WALL = "99999999-9999-4999-8999-999999999999";
const catalogue = [
  {
    id: WALL,
    sourceCode: "LC-001",
    sourceName: "Wall 1",
    name: "Стена 1",
    tileType: "wall-straight",
  },
  {
    id: FLOOR,
    sourceCode: "LC-007",
    sourceName: "Ground 1",
    name: "Пол 1",
    tileType: "floor",
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    sourceCode: "TEST-DECOR",
    sourceName: "Ground Bones",
    name: "Пол с декором",
    tileType: "floor",
    hasDecor: true,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    sourceCode: "LC-003",
    sourceName: "Wall Angle",
    name: "Угол стены",
    tileType: "wall-angle",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    sourceCode: "LC-004",
    sourceName: "Wall T-Shaped",
    name: "Т-образная стена",
    tileType: "wall-tee",
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    sourceCode: "LC-005",
    sourceName: "Wall X-Shaped",
    name: "Х-образная стена",
    tileType: "wall-cross",
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    sourceCode: "LC-006",
    sourceName: "Wall Corner",
    name: "Окончание стены",
    tileType: "wall-end",
  },
  {
    id: FRAME,
    sourceCode: "TEST-GRID",
    sourceName: "Grid 2x1",
    name: "Каркас 2×1",
    tileType: "frame",
    wallMode: "none",
    collection: "ultimate-dungeon",
    width: 2,
    height: 1,
    maxHeight: 0.6,
    supportSlots: [{ x: 0, y: 0, width: 2, height: 1, elevation: 0.6 }],
  },
  {
    id: BRIDGE,
    sourceCode: "UD-019",
    sourceName: "Bridge",
    name: "Мост 3×1",
    tileType: "bridge",
    wallMode: "none",
    collection: "ultimate-dungeon",
    width: 3,
    height: 1,
    maxHeight: 0.2,
  },
  {
    id: PEG,
    sourceCode: "TEST-PEG",
    sourceName: "Tile with insertion peg",
    name: "Плитка с выступом",
    tileType: "floor",
    wallMode: "none",
    collection: "ultimate-dungeon",
    mountDepth: 0.2,
    surfaceHeight: 0.4,
    maxHeight: 0.4,
  },
  {
    id: UD_FLOOR,
    sourceCode: "UD-016",
    sourceName: "Ground",
    name: "Каменный пол",
    tileType: "floor",
    wallMode: "edge",
    wallMask: 0,
    collection: "ultimate-dungeon",
  },
  {
    id: UD_WALL,
    sourceCode: "UD-001",
    sourceName: "Wall",
    name: "Боковая стена",
    tileType: "wall-straight",
    wallMode: "edge",
    wallMask: 1,
    collection: "ultimate-dungeon",
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    sourceCode: "UD-096",
    sourceName: "Wall Corner",
    name: "Наружный угол",
    tileType: "wall-corner",
    wallMode: "edge",
    wallMask: 0,
    collection: "ultimate-dungeon",
  },
  {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    sourceCode: "UD-097",
    sourceName: "Wall Diagonal",
    name: "Диагональная стена",
    tileType: "wall-diagonal",
    wallMode: "center",
    wallMask: 0,
    collection: "ultimate-dungeon",
  },
  {
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    sourceCode: "MA-DungeonChest",
    sourceName: "MA_DungeonChest_Full_Prop",
    name: "Сундук",
    tileType: "object",
    wallMode: "none",
    collection: "map-objects",
    canStand: false,
  },
].map((m) => ({
  ...m,
  collection: m.collection || "lost-cave",
  collectionName:
    m.collection === "ultimate-dungeon" ? "Ultimate Dungeon" : "Lost Cave",
  version: 1,
  hidden: false,
  hasDecor: !!m.hasDecor,
  canStand:
    m.canStand ?? ["floor", "stairs", "bridge", "passage"].includes(m.tileType),
  placementPoints:
    m.placementPoints ||
    (["floor", "stairs", "bridge", "passage"].includes(m.tileType)
      ? Array.from({ length: (m.width || 1) * (m.height || 1) }, (_, i) => ({
          x: (i % (m.width || 1)) + 0.5,
          y: Math.floor(i / (m.width || 1)) + 0.5,
          elevation: m.surfaceHeight ?? 0.42,
        }))
      : []),
  wallMode: m.wallMode || "center",
  textureDetail: m.textureDetail || "basic",
  supportSlots: m.supportSlots || [],
  width: m.width || 1,
  height: m.height || 1,
  surfaceHeight: m.surfaceHeight ?? 0.42,
  maxHeight: m.maxHeight || 1,
  tags: [],
  blockers: [],
  renderUrl: `/api/maps/models/${m.id}/render`,
  lodUrl: `/api/maps/models/${m.id}/lod`,
  previewUrl: "/maps/city.svg",
}));
const cubeScene = new Scene(),
  cube = new Mesh(
    new BoxGeometry(0.9, 0.4, 0.9),
    new MeshStandardMaterial({ color: 0x896849, roughness: 0.9 }),
  );
cube.position.y = 0.2;
cubeScene.add(cube);
const glb = await new GLTFExporter().parseAsync(cubeScene, { binary: true });
const frameScene = new Scene();
for (const x of [-0.95, 0, 0.95]) {
  const bar = new Mesh(
    new BoxGeometry(0.1, 0.6, 1),
    new MeshStandardMaterial({ color: 0x747b80 }),
  );
  bar.position.set(x, 0.3, 0);
  frameScene.add(bar);
}
for (const z of [-0.45, 0.45]) {
  const bar = new Mesh(
    new BoxGeometry(2, 0.6, 0.1),
    new MeshStandardMaterial({ color: 0x747b80 }),
  );
  bar.position.set(0, 0.3, z);
  frameScene.add(bar);
}
const frameGlb = await new GLTFExporter().parseAsync(frameScene, {
  binary: true,
});
const bridgeScene = new Scene(),
  bridge = new Mesh(
    new BoxGeometry(2.9, 0.2, 0.9),
    new MeshStandardMaterial({ color: 0x896849 }),
  );
bridge.position.y = 0.1;
bridgeScene.add(bridge);
const bridgeGlb = await new GLTFExporter().parseAsync(bridgeScene, {
  binary: true,
});
const pegScene = new Scene();
for (const [width, height, depth, y, colour] of [
  [0.9, 0.2, 0.9, 0.3, 0x55ccff],
  [0.5, 0.2, 0.5, 0.1, 0xf37bae],
]) {
  const part = new Mesh(
    new BoxGeometry(width, height, depth),
    new MeshStandardMaterial({ color: colour }),
  );
  part.position.y = y;
  pegScene.add(part);
}
const pegGlb = await new GLTFExporter().parseAsync(pegScene, { binary: true });
const source = newMap();
const params = new URLSearchParams(location.search);
let wallGlb = glb;
if (params.has("shaped")) {
  const wallScene = new Scene(),
    material = new MeshStandardMaterial({ color: 0x896849 });
  const left = new Mesh(new BoxGeometry(0.2, 0.8, 1), material),
    top = new Mesh(new BoxGeometry(1, 0.8, 0.2), material);
  left.position.set(-0.4, 0.4, 0);
  top.position.set(0, 0.4, -0.4);
  wallScene.add(left, top);
  wallGlb = await new GLTFExporter().parseAsync(wallScene, { binary: true });
}
source.id = "test-map";
source.name = "Крепость на переправе";
source.revision = 1;
source.document.width = 12;
source.document.height = 10;
paint(source.document, lineCells({ x: 1, y: 1 }, { x: 10, y: 1 }), WALL);
paint(source.document, lineCells({ x: 1, y: 1 }, { x: 1, y: 8 }), WALL);
paint(source.document, lineCells({ x: 10, y: 1 }, { x: 10, y: 8 }), WALL);
paint(source.document, lineCells({ x: 1, y: 8 }, { x: 10, y: 8 }), WALL);
if (!params.get("mode") || params.get("mode") === "board") {
  paint(
    source.document,
    [
      { x: 3, y: 3 },
      { x: 4, y: 4 },
    ],
    FLOOR,
  );
}
source.document.objects = [
  { id: "door", kind: "door", x: 6, y: 5, rotation: 0, scale: 1, open: false },
  {
    id: "barrel",
    kind: "barrel",
    x: 3,
    y: 6,
    rotation: 0,
    scale: 1,
    open: false,
  },
];
source.document.zones = [
  {
    id: "left",
    name: "Вход",
    rects: [{ x: 0, y: 0, width: 6, height: 10 }],
    cells: [],
  },
  {
    id: "right",
    name: "Хранилище",
    rects: [{ x: 6, y: 0, width: 6, height: 10 }],
    cells: [],
  },
];
if (params.get("kind")) {
  source.document.kind = params.get("kind");
  source.document.tiles = [];
  source.document.background = { url: "/maps/city.svg" };
}
if (params.has("areaExample")) {
  source.document.grid.visible = false;
  source.document.tiles = [
    { id: "area-floor", modelId: FLOOR, x: 4, y: 4, rotation: 0, level: 0 },
  ];
  source.document.objects = [
    {
      id: "area-chest",
      modelId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      kind: "chest",
      x: 4.5,
      y: 4.5,
      rotation: 0,
      scale: 1,
      open: false,
      placement: { tileId: "area-floor", point: 0 },
    },
  ];
  source.document.areas = [
    {
      id: "area-room",
      name: "Зал",
      hidden: params.has("hiddenArea"),
      tileIds: ["area-floor"],
      objectIds: ["area-chest"],
    },
  ];
}
let templateRevision = 1;
let board = { ...clone(source), state: initialState() };
board.state.zones.left = "visible";
board.state.tokens = [
  {
    id: "hero",
    kind: "marker",
    ref: "",
    name: "Следопыт",
    color: "#a797d4",
    size: 1,
    x: 3.5,
    y: 3.5,
    hidden: false,
    physical: false,
  },
];
if (params.has("areaExample")) {
  board.state.fog = false;
  board.state.tokens = [];
}
let display = {
  mapId: board.id,
  visible: true,
  revision: 1,
  camera: { x: 6, y: 5, cellPixels: 64, rotation: 0, fit: true },
};
window.requests = [];
window.latestBoard = clone(board);
window.EventSource = class {
  constructor() {
    setTimeout(() => this.onopen?.(), 0);
  }
  close() {}
};
const modelAssetAliases = new Map();
window.loadedModels = [];
window.releaseModelLoads = () =>
  window.pendingModelLoads?.splice(0).forEach((resolve) => resolve());
const nativeFetch = window.fetch.bind(window);
window.fetch = async (url, options = {}) => {
  const rawUrl = typeof url === "string" ? url : url.url;
  const endpoint = new URL(rawUrl, location.origin).pathname;
  if (!endpoint.startsWith("/api/")) return nativeFetch(url, options);
  url = endpoint;
  if (
    /^\/api\/(maps\/models|public\/sessions\/ABC-123\/map-models)\/[^/]+\/(render|lod)$/.test(
      url,
    )
  ) {
    window.loadedModels.push(url);
    if (params.get("slowModel") && url.includes(params.get("slowModel")))
      await new Promise((resolve) =>
        (window.pendingModelLoads ||= []).push(resolve),
      );
    if (params.has("realModels")) return nativeFetch(rawUrl, options);
    const modelId = url.split("/")[4];
    const assetUrl = url.replace(
      modelId,
      modelAssetAliases.get(modelId) || modelId,
    );
    return new Response(
      assetUrl.includes(FRAME)
        ? frameGlb
        : assetUrl.includes(BRIDGE)
          ? bridgeGlb
          : assetUrl.includes(PEG)
            ? pegGlb
            : assetUrl.includes(WALL)
              ? wallGlb
              : glb,
      {
        headers: { "Content-Type": "model/gltf-binary" },
      },
    );
  }
  if (
    url === "/api/maps/models" ||
    url === "/api/public/sessions/ABC-123/map-models"
  )
    return new Response(JSON.stringify(catalogue), {
      headers: { "Content-Type": "application/json" },
    });
  const data = options.body ? JSON.parse(options.body) : null;
  if (options.method === "PUT" || options.method === "POST")
    window.requests.push({ url, data });
  if (options.method === "PUT" && window.failNextSave) {
    const status = window.failNextSave;
    window.failNextSave = 0;
    return new Response(
      JSON.stringify({
        type: "ERROR",
        desc:
          status === 409
            ? "Карта изменена в другой вкладке"
            : "Нет связи с сервером",
      }),
      { status },
    );
  }
  if (options.method === "PUT" && /^\/api\/maps\/models\/[^/]+$/.test(url)) {
    const old = catalogue.find((m) => m.id === url.split("/")[4]);
    if (!old) return new Response("{}", { status: 404 });
    const latest = catalogue
      .filter(
        (m) =>
          m.collection === old.collection &&
          m.sourceCode === old.sourceCode &&
          m.sourceName === old.sourceName,
      )
      .sort((a, b) => b.version - a.version)[0];
    if (latest.id !== old.id || window.failNextModelSave) {
      window.failNextModelSave = false;
      return new Response(
        JSON.stringify({
          desc: "Параметры тайла уже изменены. Обновите справочник.",
        }),
        { status: 409 },
      );
    }
    const id = crypto.randomUUID();
    const saved = {
      ...old,
      ...data,
      id,
      version: latest.version + 1,
      renderUrl: `/api/maps/models/${id}/render`,
      lodUrl: `/api/maps/models/${id}/lod`,
      previewUrl: old.previewUrl,
    };
    catalogue.push(saved);
    modelAssetAliases.set(id, modelAssetAliases.get(old.id) || old.id);
    window.lastModelSaved = saved;
    return new Response(JSON.stringify(saved), {
      headers: { "Content-Type": "application/json" },
    });
  }
  let result;
  if (url === "/api/maps") {
    if (data) {
      result = { ...data, id: "test-copy", revision: 1 };
      window.lastSaved = result;
    } else
      result = [
        source,
        ...(window.lastSaved?.id === "test-copy" ? [window.lastSaved] : []),
      ];
  } else if (url === "/api/maps/test-copy") {
    result = { ...data, revision: data.revision + 1 };
    window.lastSaved = result;
  } else if (url === "/api/maps/test-map") {
    if (data.revision !== templateRevision)
      return new Response("{}", { status: 409 });
    result = { ...data, id: "test-map", revision: ++templateRevision };
    window.lastSaved = result;
  } else if (url === "/api/sessions/test/maps/test-map") {
    if (data.revision !== board.revision)
      return new Response("{}", { status: 409 });
    board = { ...board, state: data.state, revision: board.revision + 1 };
    window.latestBoard = clone(board);
    result = board;
  } else if (url === "/api/sessions/test/maps")
    result = { maps: [board], display };
  else if (url === "/api/sessions/test/map-display") {
    display = { ...data, revision: display.revision + 1 };
    window.latestDisplay = clone(display);
    result = display;
  } else if (url === "/api/public/sessions/ABC-123/map")
    result = { map: board, display };
  else return new Response("{}", { status: 404 });
  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
};
const mode = params.get("mode");
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: "/map-screen/:code", component: ViewMapScreen },
    { path: "/maps", name: "Maps", component: MapLibrary },
    { path: "/maps/editor", name: "MapEditor", component: ViewMapEditor },
  ],
});
const pinia = createPinia(),
  account = useAccountStore(pinia);
account.status = "success";
account.user = {
  id: 1,
  login: "tester",
  roles: params.has("noAdmin") ? [] : ["ADMIN"],
};
await router.push(
  mode === "library"
    ? "/maps"
    : mode === "editor"
      ? "/maps/editor?id=test-map"
      : "/map-screen/ABC-123",
);
window.mapRoute = () => router.currentRoute.value.fullPath;
createApp({
  render: () =>
    mode === "header"
      ? h(MapEditorHeader, {
          editor: { draft: source, catalogue, dirty: false },
          view: "map",
          admin: account.hasRole("ADMIN"),
        })
      : mode === "editor" || mode === "library"
        ? h(RouterView)
        : mode === "screen"
          ? h(ViewMapScreen)
          : h(
              "div",
              { style: "height:95vh;padding:16px;box-sizing:border-box" },
              [
                h(SessionMapWorkspace, {
                  sessionUuid: "test",
                  session: { displayCode: "ABC-123" },
                  participants: [],
                  encounter: { encounter: { combatants: [] } },
                }),
              ],
            ),
})
  .use(pinia)
  .use(router)
  .mount("#app");
