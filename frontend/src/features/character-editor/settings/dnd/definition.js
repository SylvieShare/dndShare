import { layoutTokens } from '@/app/design-tokens'
import stats from './fields/stats'
import identity from './fields/identity'
import personality from './fields/personality'
import features from './fields/features'
import equipment from './fields/equipment'
import utilities from './fields/utilities'

const statsTab = { id: 'stats', title: 'Статы', svg: '/static/tab-stats.svg' }
const sections = [
  { id: 'weapons', title: 'Оружие', svg: '/static/tab-weapons.svg' },
  { id: 'spells', title: 'Магия', svg: '/static/tab-magic.svg' },
  { id: 'inventory', title: 'Предметы', svg: '/static/container-box.svg' },
  { id: 'abilities', title: 'Способности', svg: '/static/tab-skills.svg' },
  { id: 'personality', title: 'Личность', svg: '/static/tab-personality.svg' },
  { id: 'journal', title: 'Дневник', svg: '/static/edit-note.svg' },
]

// Game-field parameters and navigation labels; placement belongs to Vue components.
export default {
  system: 'dnd5e', width: layoutTokens['sheet-max'],
  blocks: { ...stats, ...identity, ...personality, ...features, ...equipment, ...utilities },
  tabs: {
    phone: [statsTab, ...sections],
    tablet: [{ id: 'base', title: 'База', svg: '/static/tab-personality.svg' }, statsTab, ...sections],
    desktop: [sections[0], sections[1], sections[3], { ...sections[2], title: 'Снаряжение' }, sections[4], sections[5]],
  },
}
