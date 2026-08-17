export function resolveAppNavigation({ authenticated = false, admin = false, path = '/', rulesTo = '/rules' } = {}) {
  const items = [
    { key: 'handbook', group: 'common', title: 'Справочник', to: '/handbook', active: path.startsWith('/handbook') },
    { key: 'rules', group: 'common', title: 'Правила', to: rulesTo, active: path.startsWith('/rules') },
  ]

  if (authenticated) {
    items.push(
      { key: 'characters', group: 'player', title: 'Персонажи', to: '/chars', active: path === '/chars' || path.startsWith('/char/') },
      { key: 'create-character', group: 'player', title: 'Создать персонажа', to: '/chars/new', active: path === '/chars/new' },
      { key: 'sessions', group: 'master', title: 'Сессии', to: '/sessions', active: path.startsWith('/session') },
    )
  } else {
    items.push({ key: 'create-character', group: 'player', title: 'Создать персонажа', to: '/chars/new', active: path === '/chars/new' })
  }

  if (authenticated && admin) {
    items.push({ key: 'admin', group: 'service', title: 'Админка', to: '/admin', active: path === '/admin' })
  }

  return items
}
