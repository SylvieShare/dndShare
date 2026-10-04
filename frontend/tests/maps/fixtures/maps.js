import { BoxGeometry, Mesh, MeshStandardMaterial, Scene } from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { createApp, h } from "vue";
import { createPinia } from "pinia";
import { createRouter, createMemoryHistory, RouterView } from "vue-router";
import { useAccountStore } from "../../../src/stores/account";
import MapLibrary from "../../../src/features/maps/components/MapLibrary.vue";
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
const catalogue = [
  {
    id: WALL,
    sourceCode: "LC-001",
    sourceName: "Wall 1",
    name: "Стена 1",
    tileType: "wall",
  },
  {
    id: FLOOR,
    sourceCode: "LC-007",
    sourceName: "Ground 1",
    name: "Пол 1",
    tileType: "floor",
  },
].map((m) => ({
  ...m,
  collection: "lost-cave",
  version: 1,
  terrainType: "cave",
  wallLayout: m.tileType === "wall" ? "straight" : "none",
  width: 1,
  height: 1,
  surfaceHeight: 0.42,
  maxHeight: 1,
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
const source = newMap();
const params = new URLSearchParams(location.search);
source.id = "test-map";
source.name = "Крепость на переправе";
source.revision = 1;
source.document.width = 12;
source.document.height = 10;
paint(source.document, lineCells({ x: 1, y: 1 }, { x: 10, y: 1 }), WALL);
paint(source.document, lineCells({ x: 1, y: 1 }, { x: 1, y: 8 }), WALL);
paint(source.document, lineCells({ x: 10, y: 1 }, { x: 10, y: 8 }), WALL);
paint(source.document, lineCells({ x: 1, y: 8 }, { x: 10, y: 8 }), WALL);
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
  )
    return new Response(glb, {
      headers: { "Content-Type": "model/gltf-binary" },
    });
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
  let result;
  if (url === "/api/maps") {
    if (data) {
      result = { ...data, id: "test-copy", revision: 1 };
      window.lastSaved = result;
    } else result = [source, ...(window.lastSaved?.id === "test-copy" ? [window.lastSaved] : [])];
  }
  else if (url === "/api/maps/test-copy") {
    result = { ...data, revision: data.revision + 1 };
    window.lastSaved = result;
  }
  else if (url === "/api/maps/test-map") {
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
const pinia = createPinia(), account = useAccountStore(pinia);
account.status = "success";
account.user = { id: 1, login: "tester", roles: ["ADMIN"] };
await router.push(mode === "library" ? "/maps" : mode === "editor" ? "/maps/editor?id=test-map" : "/map-screen/ABC-123");
window.mapRoute = () => router.currentRoute.value.fullPath;
createApp({
  render: () =>
    mode === "editor" || mode === "library"
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
