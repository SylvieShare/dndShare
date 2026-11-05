import { applyDocumentPatches } from '../../../src/shared/lib/documentPatch.js'
import { TUTORIAL_REVISION } from '../../../src/features/tutorials/lib/tutorialIdentity.js'

export async function fixture(page, templateName = 'DND5', owner = true, catalogue = false) {
  const values = { name: 'Лира', char_name: 'Алекс', hp: { current: 18, max: { base: 23, bonuses: [] }, hitDice: [] },
    lvl: { level: 3, exp: 700 }, prof_bonus: { v: 2, auto: true }, speed: { base: 30, bonuses: [] }, armor: { bonuses: [] },
    initiative: { base: 0, use_dex: true, bonuses: [] }, items: { equipped: [], sections: [] }, states: [], exhaustion: { level: 0 },
    clan: 'Тореадор', strength: 3, dexterity: 2, stamina: 2 }
  for (const [index, stat] of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].entries()) {
    values[stat] = { value: { base: 12 + index, bonuses: [] }, skills: Object.fromEntries(Array.from({ length: [1, 3, 0, 5, 5, 4][index] }, (_, j) => [String(100 + index * 10 + j), { up: 0, override_title: `Навык ${index + 1}.${j + 1}` }])) }
  }
  if (catalogue) Object.assign(values, {
    weapon: [{ uid: 'staff', item_id: 201 }],
    items: { equipped: [{ uid: 'potion', item_id: 202, count: 1 }], sections: [] },
    classes: [{ id: 203, name: 'Воин', level: 3 }],
    abilities_class: [{ id: 205 }],
    spells: { tabs: [{ key: 'book', name: 'Книга заклинаний', mode: 'known', spells: [{ key: 'spell', id: 206 }] }], grants: [] },
  })
  const requests = []
  let document = { values, var: { stats: { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3 } } }, version = 1
  const writes = []
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const target = new URL(route.request().url())
    const path = target.pathname
    requests.push(path)
    if (route.request().method() === 'PATCH' && path === '/api/char/test/data') {
      const body = route.request().postDataJSON()
      writes.push(body)
      document = applyDocumentPatches(document, body.patches)
      return route.fulfill({ json: { fromVersion: version, version: ++version, mutationId: body.mutationId, patches: body.patches } })
    }
    let json = {}
    if (path === "/api/user/checkAuth") json = { auth: true, user: { id: 1, login: "tester", roles: [], hasCharacters: true, gameContext: { sourceVersionId: 1 } } }
    if (path === '/api/char/test') json = { templateName, userId: owner ? 1 : 2, sourceVersionId: 1, version, data: document }
    if (path === '/api/account/tutorials') json = { tutorials: ['mobile', 'desktop'].map(device => ({ flowId: 'character', sourceKey: 'edition:1', device, status: 'completed', revision: TUTORIAL_REVISION })) }
    if (path === '/api/suggest/batch') json = { items: { 16: ['Сила', 'Ловкость', 'Телосложение', 'Интеллект', 'Мудрость', 'Харизма'].map((value, i) => ({ id: i + 1, typeId: 16, value })), 15: [] } }
    if (path === '/api/items/by-ids') json = { items: [] }
    if (path === '/api/items/by-ids' && catalogue) json = { items: target.searchParams.get('ids').split(',').map(Number).map(id => ({ id, typeId: id === 201 ? 1 : id === 203 ? 3 : id === 206 ? 6 : 5, name: {201:'Кешированный посох',202:'Кешированное зелье',203:'Воин',205:'Кешированная способность',206:'Кешированное заклинание'}[id] || 'Предмет ' + id, data: id === 206 ? { lvl: 1 } : {} })) }
    if (path === '/api/sources') json = { sources: [{ id: 1, name: 'DND5e', versions: [{ id: 1, version: '2014' }] }] }
    if (path === '/api/char/test/changes') json = { fromVersion: version, version, patches: [] }
    await route.fulfill({ json })
  })
  return { writes, requests, document: () => document }
}
