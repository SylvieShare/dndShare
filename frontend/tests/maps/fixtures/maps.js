import { previewFixture } from "./previews";
import { attachmentExample } from "./attachments";
import { groupExamples } from "./groups";
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
import {
  WALL,
  FLOOR,
  FRAME,
  BRIDGE,
  PEG,
  UD_FLOOR,
  UD_WALL,
  catalogue,
  glb,
  frameGlb,
  bridgeGlb,
  pegGlb,
} from "./catalogue";
const source = newMap();
const params = new URLSearchParams(location.search);
if (params.has("groups")) groupExamples(catalogue);
if (params.has("tileFilterExample")) {
  catalogue.find((m) => m.id === UD_WALL).hasDecor = true;
  catalogue.find((m) => m.sourceCode === "UD-096").hidden = true;
  const angle = catalogue.find((m) => m.sourceCode === "LC-003");
  Object.assign(angle, {
    name: "Проём с обстановкой",
    tileType: "passage",
    hasDecor: true,
  });
}
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
  if (params.has("lightExample"))
    catalogue.find((m) => m.id === WALL).blockers = [
      [
        [0, 0],
        [1, 0],
        [1, 0.2],
        [0.2, 0.2],
        [0.2, 1],
        [0, 1],
      ],
    ];
}
source.id = "test-map";
source.name = "Крепость на переправе";
source.revision = 1;
source.document.tags = ["подземелье", "камень"];
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
  if (params.has("twoAreaObjects")) {
    source.document.tiles.push({
      ...source.document.tiles[0],
      id: "area-floor-2",
      x: 5,
    });
    source.document.objects.push({
      ...source.document.objects[0],
      id: "area-chest-2",
      x: 5.5,
      placement: { tileId: "area-floor-2", point: 0 },
    });
    source.document.areas[0].tileIds.push("area-floor-2");
    source.document.areas[0].objectIds.push("area-chest-2");
  }
}
if (params.has("attachmentExample")) attachmentExample(source, Scene);
if (params.has("lightExample")) {
  source.document.lightingEnabled = true;
  source.document.sun = { enabled: false, angle: 225, elevation: 45 };
  source.document.grid.visible = false;
  source.document.tiles = [
    { id: "light-floor", modelId: FLOOR, x: 4, y: 4, level: 0, rotation: 0 },
    { id: "light-wall", modelId: WALL, x: 5, y: 4, level: 0, rotation: 0 },
    { id: "light-receiver", modelId: FLOOR, x: 6, y: 4, level: 0, rotation: 0 },
  ];
  source.document.objects = [];
  if (params.has("lit"))
    source.document.lights = [
      {
        id: "test-light",
        name: "Факел",
        kind: "torch",
        color: "#ff8c44",
        x: 4.5,
        y: 4.5,
        elevation: 0.2,
        height: 0.55,
        intensity: 12,
        radius: 4,
        enabled: true,
        showMarker: true,
        shadows: !params.has("noShadow"),
        flicker: false,
        offset: [0, 0],
      },
    ];
}
if (params.has("lightBenchmark")) {
  source.document.lightingEnabled = true;
  source.document.width = source.document.height = 20;
  source.document.tiles = [];
  source.document.objects = [];
  source.document.grid.visible = false;
  for (let y = 1; y < 19; y++)
    for (let x = 1; x < 19; x++)
      source.document.tiles.push({
        id: `bench-${x}-${y}`,
        modelId: x === 1 || y === 1 || x === 18 || y === 18 ? WALL : FLOOR,
        x,
        y,
        level: 0,
        rotation: 0,
      });
  source.document.lights = [0, 1].map((i) => ({
    id: `lamp-${i}`,
    name: "Факел",
    kind: "torch",
    color: i ? "#7ccaff" : "#ffc36a",
    x: 7 + i * 6,
    y: 9,
    elevation: 0.3,
    height: 1.1,
    intensity: 12,
    radius: 8,
    enabled: true,
    showMarker: true,
    shadows: true,
    flicker: true,
    offset: [0, 0],
  }));
}
if (params.has("transitions")) {
  const torch = catalogue.find((m) => m.id === WALL),
    targetId = "10101010-1010-4010-8010-101010101010";
  const flame = {
    key: "flame",
    name: "Встроенный факел",
    kind: "torch",
    color: "#ffc36a",
    position: [0.5, 0.7, 0.9],
    intensity: 8,
    radius: 4.5,
    enabled: true,
    flicker: true,
  };
  torch.behaviour = {
    revision: 1,
    defaultLights: [
      flame,
      { ...flame, key: "candle", name: "Встроенная свеча" },
    ],
    transitions: [
      {
        id: "12121212-1212-4212-8212-121212121212",
        toDefinitionId: "LC-001-OFF",
        action: "extinguish",
      },
    ],
  };
  catalogue.push({
    ...torch,
    id: targetId,
    sourceCode: "LC-001-OFF",
    sourceName: "Unlit",
    name: "Потухший факел",
    definitionId: "LC-001-OFF",
    behaviour: {
      revision: 1,
      defaultLights: [],
      transitions: [
        {
          id: "13131313-1313-4313-8313-131313131313",
          toDefinitionId: torch.definitionId,
          action: "ignite",
        },
      ],
    },
  });
  source.document.tiles = [
    { id: "torch-tile", modelId: WALL, x: 4, y: 4, rotation: 0, level: 0 },
  ];
  source.document.objects = [];
  source.document.areas = [
    {
      id: "torch-room",
      name: "Комната",
      hidden: false,
      tileIds: ["torch-tile"],
      objectIds: [],
    },
  ];
  source.document.lights = [
    {
      id: "attached-lamp",
      name: "Прикреплённая лампа",
      kind: "magic",
      color: "#a98aff",
      x: 4.5,
      y: 4.5,
      elevation: 0.42,
      height: 0.5,
      intensity: 5,
      radius: 3,
      enabled: true,
      shadows: false,
      flicker: false,
      showMarker: false,
      offset: [0, 0],
      anchor: { kind: "tile", id: "torch-tile" },
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
if (params.has("lightExample")) {
  board.state.fog = false;
  board.state.tokens = [];
}
if (params.has("lightBenchmark")) {
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
if (params.get("mode") === "library" && params.has("tagsExample")) {
  const key = "fixture-document:" + location.search;
  const stored = sessionStorage.getItem(key);
  if (stored) source.document = JSON.parse(stored);
  else sessionStorage.setItem(key, JSON.stringify(source.document));
}
const modelAssetAliases = new Map();
window.loadedModels = [];
window.releaseModelLoads = () =>
  window.pendingModelLoads?.splice(0).forEach((resolve) => resolve());
const nativeFetch = window.fetch.bind(window);
const modelDto = ({ id, definitionId, ...model }) => ({
  ...model,
  id: definitionId,
  uuid: id,
});
const previews = previewFixture(catalogue, modelDto);
window.fetch = async (url, options = {}) => {
  const rawUrl = typeof url === "string" ? url : url.url;
  const endpoint = new URL(rawUrl, location.origin).pathname;
  if (!endpoint.startsWith("/api/")) return nativeFetch(url, options);
  const preview = await previews.handle(rawUrl, options);
  if (preview) return preview;
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
    return new Response(JSON.stringify(catalogue.map(modelDto)), {
      headers: { "Content-Type": "application/json" },
    });
  let data = options.body ? JSON.parse(options.body) : null;
  if (data && /^\/api\/maps\/models\/[^/]+$/.test(url)) {
    const { id, uuid, ...fields } = data;
    data = { ...fields, id: uuid, definitionId: id };
  }
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
    if (window.failNextModelSave) {
      window.failNextModelSave = false;
      return new Response(
        JSON.stringify({
          desc: "Параметры тайла уже изменены. Обновите справочник.",
        }),
        { status: 409 },
      );
    }
    const saved = { ...old, ...data, id: old.id };
    catalogue.splice(catalogue.indexOf(old), 1, saved);
    window.lastModelSaved = saved;
    return new Response(JSON.stringify(modelDto(saved)), {
      headers: { "Content-Type": "application/json" },
    });
  }
  let result;
  if (url === "/api/maps") {
    if (data) {
      result = {
        ...data,
        id: "test-copy",
        revision: 1,
        changedAt: new Date().toISOString(),
      };
      window.lastSaved = result;
    } else
      result = [
        source,
        ...(params.has("tagsExample")
          ? [
              {
                ...clone(source),
                id: "forest-map",
                name: "Лесная поляна",
                document: { ...clone(source.document), tags: ["лес", "улица"] },
              },
              {
                ...clone(source),
                id: "forest-dungeon",
                name: "Заброшенный храм",
                document: {
                  ...clone(source.document),
                  tags: ["лес", "подземелье"],
                },
              },
            ]
          : []),
        ...(window.lastSaved?.id === "test-copy" ? [window.lastSaved] : []),
      ];
  } else if (url === "/api/maps/test-copy") {
    result = {
      ...data,
      revision: data.revision + 1,
      changedAt: new Date().toISOString(),
    };
    window.lastSaved = result;
  } else if (url === "/api/maps/test-map") {
    if (data.revision !== templateRevision)
      return new Response("{}", { status: 409 });
    result = {
      ...data,
      id: "test-map",
      revision: ++templateRevision,
      changedAt: new Date().toISOString(),
    };
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
  if (url === "/api/maps")
    result = Array.isArray(result)
      ? await Promise.all(result.map(previews.decorate))
      : await previews.decorate(result);
  else if (/^\/api\/maps\/[^/]+$/.test(url))
    result = await previews.decorate(result);
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
          editor: {
            draft: source,
            catalogue,
            dirty: false,
            history: [],
            future: [],
            selectedTiles: [],
            selectedObjects: [],
            selectedLight: "",
          },
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
