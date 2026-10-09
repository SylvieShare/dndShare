import { useTemplateStore } from "../../../src/stores/template";
export function sessionFixture(pinia, source, params) {
  useTemplateStore(pinia).templates = [{ id: 41, name: "DND5" }];
  const participants = params.has("creatures")
    ? [
        {
          charId: 41,
          charUuid: "character-41",
          templateId: 41,
          color: "#a797d4",
          data: {
            values: {
              name: "Лира",
              hp: { current: 18, max: 24, temp: 3 },
              armor: { total: 14 },
            },
          },
        },
      ]
    : [];
  const npcs = params.has("creatures")
    ? [
        {
          uid: "ogre",
          type: "npc",
          markerLetter: "A",
          hpCurrent: 23,
          hpTemp: 0,
          position: "reserve",
          iconColor: "#c18f6f",
        },
      ]
    : [];
  const encounter = {
    encounter: { combatants: npcs },
    npcName: () => "Огр",
    npcItem: () => null,
    npcHpObj: (c) => ({ current: c.hpCurrent, max: 30, temp: c.hpTemp }),
  };
  return { participants, encounter };
}
export function sessionAPI(initial, initialDisplay, getSource) {
  let maps = [initial],
    display = initialDisplay;
  const response = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  return function handle(url, options, data) {
    if (url === "/api/sessions/test/maps" && options.method === "POST") {
      const base = getSource(data.mapId),
        map = {
          ...structuredClone(base),
          id: `opened-${maps.length}`,
          source: { id: base.id, name: base.name, system: false },
          revision: 1,
          state: {
            fog: false,
            defaultVisibility: "visible",
            zones: {},
            objects: {},
            tokens: [],
          },
        };
      maps.push(map);
      window.latestBoard = structuredClone(map);
      return response(map);
    }
    if (url === "/api/sessions/test/maps") return response({ maps, display });
    const match = url.match(/^\/api\/sessions\/test\/maps\/([^/]+)$/);
    if (match) {
      const index = maps.findIndex((m) => m.id === match[1]);
      if (index < 0) return response({}, 404);
      if (options.method === "DELETE") {
        maps.splice(index, 1);
        return new Response(null, { status: 204 });
      }
      const current = maps[index];
      if (data.revision !== current.revision) return response({}, 409);
      if (!data.document || !data.name) return response({}, 400);
      maps[index] = {
        ...current,
        name: data.name,
        document: data.document,
        state: data.state,
        revision: data.revision + 1,
        changedAt: new Date().toISOString(),
      };
      window.latestBoard = structuredClone(maps[index]);
      return response(maps[index]);
    }
    if (url === "/api/sessions/test/map-display") {
      display = { ...data, revision: display.revision + 1 };
      window.latestDisplay = structuredClone(display);
      return response(display);
    }
    if (url === "/api/public/sessions/ABC-123/map")
      return response({
        map: maps.find((m) => m.id === display.mapId) || null,
        display,
      });
    return null;
  };
}
