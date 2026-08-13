export function resolveAppNavigation({ authenticated = false, admin = false, path = '/' } = {}) {
  const items = [
    { key: 'handbook', title: 'Справочник', to: '/handbook', active: path.startsWith('/handbook') },
  ]

  if (authenticated) {
    items.push(
      { key: 'sessions', title: 'Сессии', to: '/sessions', active: path.startsWith('/session') },
      { key: 'characters', title: 'Персонажи', to: '/chars', active: path.startsWith('/char') || path === '/chars' },
    )
  }

  if (authenticated && admin) {
    items.push({ key: 'admin', title: 'Админка', to: '/admin', active: path === '/admin' })
  }

  return items
}
