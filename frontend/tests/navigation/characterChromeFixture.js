import { TUTORIAL_REVISION } from '../../src/features/tutorials/lib/tutorialIdentity.js'

const source = { id: 1, name: 'dnd5e', versions: [{ id: 1, version: '2014' }] }
export async function installCharacterChromeFixture(page) {
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (/^\/api\/char\/chrome-\d+$/.test(path)) {
      const index = Number(path.split('-').at(-1))
      return route.fulfill({ json: { templateName: 'DND5', userId: 1, sourceId: 1, sourceVersionId: 1, version: 1, data: { values: { name: 'Персонаж ' + index, lvl: { level: 1 }, classes: [], hp: { current: 10, max: { base: 10, bonuses: [] } }, items: { equipped: [], sections: [] }, states: [] }, var: {} } } })
    }
    return route.fulfill({ json: {
      '/api/user/checkAuth': { auth: true, user: { id: 1, login: 'tester', roles: [], hasCharacters: true, gameContext: { sourceVersionId: 1 } } },
      '/api/sources': { sources: [source] },
      '/api/templates': { templates: [{ id: 1, name: 'DND5', sourceId: 1 }] },
      '/api/chars': { chars: Array.from({ length: 30 }, (_, index) => ({
        id: index + 1, uuid: 'chrome-' + index, userId: 1, templateId: 1,
        sourceId: 1, sourceName: 'D&D 5e', sourceVersion: '2014', changedAt: '2026-10-29T08:00:00Z',
        data: { values: { name: 'Персонаж ' + index, lvl: { level: 1 }, classes: [] }, var: {} },
      })) },
      '/api/suggest/types': { items: [] }, '/api/sessions/active': { sessions: [] },
      '/api/item-types': { types: [] },
      '/api/items/by-ids': { items: [] },
      '/api/suggest/batch': { items: {} },
      '/api/account/tutorials': { tutorials: ['mobile', 'desktop'].map(device => ({ flowId: 'character', sourceKey: 'edition:1', device, status: 'completed', revision: TUTORIAL_REVISION })) },
    }[path] || {} })
  })
}
