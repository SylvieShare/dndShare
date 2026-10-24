// An asymmetric miniature with a separately transformed small detail, in GLB 2.
function modelGLB() {
  const positions = new Float32Array([
    -0.25, 0, -0.15, 0.3, 0, -0.15, 0, 0.9, 0, 0, 0.1, 0.25,
  ]);
  const indices = new Uint16Array([0, 2, 1, 0, 3, 2, 1, 2, 3, 0, 1, 3]);
  const bin = Buffer.concat([
    Buffer.from(positions.buffer),
    Buffer.from(indices.buffer),
  ]);
  const json = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: [
      { mesh: 0, translation: [0, 0.04, 0] },
      { mesh: 0, translation: [0.32, 0.04, 0], scale: [0.07, 0.05, 0.06] },
    ],
    meshes: [
      {
        primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }],
      },
    ],
    materials: [
      {
        doubleSided: true,
        pbrMetallicRoughness: {
          baseColorFactor: [0, 0.8, 1, 1],
          metallicFactor: 0,
          roughnessFactor: 0.8,
        },
      },
    ],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      {
        buffer: 0,
        byteOffset: 0,
        byteLength: positions.byteLength,
        target: 34962,
      },
      {
        buffer: 0,
        byteOffset: positions.byteLength,
        byteLength: indices.byteLength,
        target: 34963,
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 4,
        type: "VEC3",
        min: [-0.25, 0, -0.15],
        max: [0.3, 0.9, 0.25],
      },
      { bufferView: 1, componentType: 5123, count: 12, type: "SCALAR" },
    ],
  };
  const text = Buffer.from(JSON.stringify(json)),
    padding = Buffer.alloc((4 - (text.length % 4)) % 4, 32);
  const chunk = Buffer.concat([text, padding]),
    header = Buffer.alloc(20),
    binaryHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + chunk.length + bin.length, 8);
  header.writeUInt32LE(chunk.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  binaryHeader.writeUInt32LE(bin.length, 0);
  binaryHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, chunk, binaryHeader, bin]);
}

export async function itemModelFixture(
  page,
  { typeId = 6, hasModel = true, slow = false, fail = false, binary } = {},
) {
  const glb = binary || modelGLB();
  const state = { metadata: 0, files: 0, catalogues: 0, fail };
  const gate = slow
    ? new Promise((resolve) => {
        state.release = resolve;
      })
    : Promise.resolve();
  const type = {
    id: typeId,
    sourceId: 1,
    name: typeId === 6 ? "Бестиарий" : "Вещи",
    fields: [],
    count: 2,
    countItems: 2,
  };
  const items = [
    {
      id: 1,
      typeId,
      name: "Кобольд",
      modelId: hasModel ? "miniature" : undefined,
      coverImageUrl: "/fixture-cover.svg",
      contentSources: [{ id: 1, name: "Monster Manual", code: "MM" }],
      data: {
        combat: { ac: 12, hp: 5, cr: "1/8", speed: 30 },
        stats: { str: 7, dex: 15, con: 9, int: 8, wis: 7, cha: 8 },
      },
    },
    {
      id: 2,
      typeId,
      name: "Без модели",
      coverImageUrl: "/fixture-cover.svg",
      data: {},
    },
  ];
  await page.route("**/fixture-cover.svg", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#796a49"/></svg>',
    }),
  );
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/maps/models") state.catalogues++;
      if (url.pathname === "/api/items/1/model") {
        state.metadata++;
        await gate;
        await route.fulfill({
          json: {
            id: "miniature",
            renderUrl: "/api/items/1/model/render?sha=test",
            lodUrl: "/api/items/1/model/lod?sha=test",
            assetBytes: { render: glb.length },
          },
        });
        return;
      }
      if (url.pathname === "/api/items/1/model/render") {
        state.files++;
        await route.fulfill(
          state.fail
            ? { status: 503, json: { desc: "temporary" } }
            : { contentType: "model/gltf-binary", body: glb },
        );
        return;
      }
      let json = {};
      if (url.pathname === "/api/user/checkAuth") json = { auth: false };
      if (url.pathname === "/api/sources")
        json = {
          sources: [
            { id: 1, name: "DND5", versions: [{ id: 1, version: "2014" }] },
          ],
        };
      if (url.pathname === "/api/item-types") json = { types: [type] };
      if (url.pathname === "/api/items") json = { items };
      if (url.pathname === "/api/items/by-ids")
        json = {
          items: items.filter((i) =>
            (url.searchParams.get("ids") || "")
              .split(",")
              .includes(String(i.id)),
          ),
        };
      await route.fulfill({ json });
    },
  );
  return state;
}
