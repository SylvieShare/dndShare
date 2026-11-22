import { readFileSync } from 'node:fs'
import { TUTORIAL_REVISION } from '../../../src/features/tutorials/lib/tutorialIdentity.js'

const release = JSON.parse(readFileSync(new URL('../../../../release/versions.json', import.meta.url), 'utf8'))

export async function installCharacterTransferReference(page, { mobile }) {
  const character = { templateName: 'DND5', userId: 1, sourceVersionId: 1, version: 1, data: { values: {
    name: 'Торин', hp: { current: 10, max: { base: 10, bonuses: [] }, hitDice: [] },
    STR: { value: 10 }, DEX: { value: 10 }, CON: { value: 10 }, INT: { value: 10 }, WIS: { value: 10 }, CHA: { value: 10 },
  }, var: { stats: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } } } }
  const session = { uuid: 'campaign', name: 'Тайны долины' }
  const item = { id: 42, name: 'Верёвка', typeId: 2, iconImageUrl: '/static/tab-stats.svg', data: { desc: 'Описание из справочника' } }
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    let json = {}
    if (path === '/api/user/checkAuth') json = { auth: true, user: { id: 1, login: 'tester', roles: [], hasCharacters: true, gameContext: { sourceVersionId: 1 } } }
    else if (path === '/api/build-info') json = { backend: { ...release.backend, apiContract: release.contracts.api }, frontend: release.frontend }
    else if (path === '/api/sources') json = { sources: [{ id: 1, name: 'dnd5e', versions: [{ id: 1, version: '2014' }] }] }
    else if (path === '/api/handbook/sync') json = { protocol: 1, entries: [], hasMore: false, cursor: 'empty', visibleIds: [], metadata: { types: [], suggests: {}, suggestTypes: [], books: [] } }
    else if (path === '/api/account/tutorials') json = { tutorials: [{ flowId: 'character', sourceKey: 'edition:1', device: mobile ? 'mobile' : 'desktop', revision: TUTORIAL_REVISION, status: 'completed' }] }
    else if (path === '/api/char/recipient') json = character
    else if (path === '/api/char/recipient/version') json = { version: 1 }
    else if (path === '/api/char/recipient/sessions') json = { sessions: [session] }
    else if (path === '/api/templates') json = { templates: [{ id: 1, name: 'DND5' }] }
    else if (path === '/api/items/by-ids') json = { items: [item] }
    else if (path === '/api/char/recipient/item-transfers') json = { transfers: [1, 2].map(id => ({ id, senderCharUuid: 'sender', recipientCharUuid: 'recipient',
      senderName: 'Лиора', senderImageUrl: '/static/tab-stats.svg', recipientName: 'Торин', itemName: 'Верёвка', source: 'items', entry: { item_id: 42, count: 1 }, status: 'pending' })) }
    else if (path === '/api/sessions/campaign') json = { session, participants: [{ charUuid: 'recipient', templateId: 1, data: character.data },
      { charUuid: 'sender', templateId: 1, data: { values: { name: 'Лиора' } } }] }
    await route.fulfill({ json })
  })
}
