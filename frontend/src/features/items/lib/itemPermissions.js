export function canEditHandbookItem(item, account) {
  if (!item || account?.authStatus !== 'success') return false
  const user = account.user
  return user?.roles?.some(role => ['ADMIN', 'HANDBOOK_ADMIN'].includes(role))
    || (item.userId != null && user?.id != null && String(item.userId) === String(user.id))
}

// New entries are always personal; only existing base items have publication controls.
export function canSelectItemPublication(item) {
  return item != null && item.userId == null
}
