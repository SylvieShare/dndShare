import { layoutTokens } from '@/app/design-tokens'
import identity from './identity'
import points from './points'

const base = { id: 'base', title: 'База', svg: '/static/tab-personality.svg' }
const personality = { id: 'personality', title: 'Личность', svg: '/static/tab-personality.svg' }
const notes = { id: 'journal', title: 'Заметки', svg: '/static/edit-note.svg' }
const compact = [base,
  { id: 'stats', title: 'Характеристики', svg: '/static/tab-stats.svg' },
  { id: 'abilities', title: 'Способности', svg: '/static/tab-skills.svg' },
  { id: 'advantages', title: 'Преимущества', svg: '/static/tab-magic.svg' },
  personality, notes,
]
export default {
  system: 'vtm-v20', width: layoutTokens['sheet-max'],
  blocks: { ...identity, ...points },
  tabs: { desktop: [base, personality, notes], tablet: compact, phone: compact },
}
