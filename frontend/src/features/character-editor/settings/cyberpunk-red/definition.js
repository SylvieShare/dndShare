import { layoutTokens } from '@/app/design-tokens'
const tabs = [
  { id: 'base', title: 'База', svg: '/static/tab-personality.svg' },
  { id: 'skills', title: 'Навыки', svg: '/static/tab-stats.svg' },
  { id: 'combat', title: 'Бой', svg: '/static/tab-weapons.svg' },
  { id: 'cyberware', title: 'Киберимпланты', svg: '/static/tab-red-cyberware.svg' },
  { id: 'netrunning', title: 'Сеть', svg: '/static/tab-red-net.svg' },
  { id: 'inventory', title: 'Предметы', svg: '/static/container-box.svg' },
  { id: 'roles', title: 'Роли и развитие', svg: '/static/tab-red-roles.svg' },
  { id: 'personality', title: 'Личность', svg: '/static/tab-personality.svg' },
  { id: 'journal', title: 'Дневник', svg: '/static/edit-note.svg' },
]
export default { system: 'cyberpunk-red', width: layoutTokens['sheet-max'], blocks: {},
  tabs: { phone: tabs, tablet: tabs, desktop: tabs } }
