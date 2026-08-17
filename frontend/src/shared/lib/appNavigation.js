export function resolveAppNavigation({ authenticated = false, admin = false, path = '/' } = {}) {
  const items = [
    { key: 'handbook', group: 'common', title: 'Справочник', to: '/handbook', active: path.startsWith('/handbook') },
  ]

  if (authenticated) {
    items.push(
      { key: 'characters', group: 'player', title: 'Персонажи', to: '/chars', active: path.startsWith('/char') || path === '/chars' },
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
