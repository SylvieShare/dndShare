export function resolveAppNavigation({ authenticated = false, hasCharacters = false, admin = false, path = '/', rulesTo = '/rules' } = {}) {
  const items = [
    { key: 'handbook', group: 'common', title: 'Справочник', to: '/handbook', active: path.startsWith('/handbook') },
    { key: 'rules', group: 'player', title: 'Правила игрока', to: rulesTo, active: path.startsWith('/rules') },
  ]

  if (authenticated) {
    items.push(hasCharacters
      ? { key: 'characters', group: 'player', title: 'Персонажи', to: '/chars', active: path === '/chars' || path.startsWith('/chars/') || path.startsWith('/char/') }
      : { key: 'create-character', group: 'player', title: 'Создать персонажа', to: '/chars/new', active: path === '/chars/new' })
    items.push({ key: 'sessions', group: 'master', title: 'Сессии', to: '/sessions', active: path.startsWith('/session') })
  } else {
    items.push({ key: 'create-character', group: 'player', title: 'Создать персонажа', to: '/chars/new', active: path === '/chars/new' })
  }

  if (authenticated && admin) {
    items.push({ key: 'admin', group: 'service', title: 'Админка', to: '/admin', active: path === '/admin' })
  }

  return items
}
