import { reactive } from 'vue';
import { documentMutationFixture } from "./documentMutations";
import { useTemplateStore } from "../../../src/stores/template";
import { useSuggestStore } from "../../../src/stores/suggest";
export function sessionFixture(pinia, source, params) {
  useTemplateStore(pinia).templates = [{ id: 41, name: "DND5" }];
  if (params.has("largeCreature") && !useSuggestStore(pinia).loaded(18))
    useSuggestStore(pinia).set(18, [{ id: 403, code: "large", value: "Большой" }]);
  const participants = params.has("creatures")
    ? [
        {
          charId: 41,
          charUuid: "character-41",
          iconImageUrl: params.has("tokenPortraits")
            ? "/tests/maps/fixtures/player-portrait.png"
            : "",
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
          ...(params.has("miniatures") ? { itemId: 1635 } : {}),
          type: "npc",
          markerLetter: "A",
          hpCurrent: 23,
          hpTemp: 0,
          position: "reserve",
          iconColor: "#c18f6f",
        },
      ]
    : [];
  const npcItem = params.has("largeCreature")
    ? { id: 2579, typeId: 6, name: "Огр", data: { identity: { size: [403] } } }
    : params.has("tokenPortraits") ? { iconSvgId: 700, svg: '<svg viewBox="0 0 128 64" />' } : null;
  const encounter = reactive({
    encounter: { combatants: npcs },
    findParticipant: id => participants.find(p => p.charId === id), playerDisplayName: () => 'Лира', getPlayerAva: () => participants[0]?.iconImageUrl,
    playerDsHp: () => ({ current: 18 }), playerHpLabel: () => '18 / 24',
    openHpCalc() {}, openNpcHpEdit() {},
    canEditPlayerHp: () => true, statesValue: () => [], tileColor: c => c.iconColor,
    avatarStyle: c => ({ color: c.iconColor }), displayAc: () => 13, npcHpFormula: () => '',
    hpPercent: c => c.hpCurrent / 30 * 100, hpColor: () => 'var(--success)', hpTempValue: c => c.hpTemp || 0, hpTempPercent: () => 0,
    hpLabel: c => `${c.hpCurrent} / 30`, npcDsHp: c => ({ current: c.hpCurrent }), ENCOUNTER_LETTERS: ['A', 'B'],
    setSide: (c, side) => { if (side) c.side = side; else delete c.side },
    npcName: () => "Огр",
    npcItem: () => npcItem,
    npcHpObj: (c) => ({ current: c.hpCurrent, max: 30, temp: c.hpTemp }),
  });
  window.creatureEncounter = encounter;
  return { participants, encounter };
}
export function sessionAPI(initial, initialDisplay, getSource) {
  const mutate = documentMutationFixture(["name", "document", "state"]);
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
          source: { id: base.id, name: base.name },
          publishedAt: null,
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
    if (window.concurrentMapName) {
      maps[0].name = window.concurrentMapName;
      maps[0].revision++;
      window.concurrentMapName = "";
    }
    const changes = url.match(/^\/api\/sessions\/test\/maps\/([^/]+)\/changes/);
    if (changes) {
      const map = maps.find((m) => m.id === changes[1]);
      return response({
        version: map.revision,
        data: { name: map.name, document: map.document, state: map.state },
        metadata: { id: map.id, revision: map.revision },
      });
    }
    const match = url.match(/^\/api\/sessions\/test\/maps\/([^/]+)$/);
    if (match) {
      const index = maps.findIndex((m) => m.id === match[1]);
      if (index < 0) return response({}, 404);
      if (options.method === "DELETE") {
        if (display.mapId === maps[index].id)
          display = {
            ...display,
            mapId: null,
            visible: false,
            revision: display.revision + 1,
          };
        maps.splice(index, 1);
        return new Response(null, { status: 204 });
      }
      const current = maps[index];
      if (options.method === "PATCH") {
        const result = mutate(current, data);
        if (result.record) {
          maps[index] = result.record;
          window.latestBoard = structuredClone(result.record);
        }
        return response(result.response, result.status || 200);
      }
      return response({}, 405);
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

export function tokenPortraitExample(board) {
  board.state.fog = false;
  board.state.tokens = [
    {
      id: "hero",
      kind: "player",
      ref: "41",
      name: "Лира",
      color: "#a797d4",
      size: 1,
      x: 3.5,
      y: 3.5,
      hidden: false,
      physical: false,
    },
    {
      id: "ogre-token",
      kind: "creature",
      ref: "ogre",
      name: "A · Огр",
      color: "#c18f6f",
      size: 1,
      x: 4.5,
      y: 4.5,
      hidden: false,
      physical: false,
    },
  ];
}
