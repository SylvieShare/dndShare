import { RED_ROLES } from './catalogue.js'
import { redHealthMaximum } from './derived.js'

export const redAccessors = {
  system: 'cyberpunk-red',
  hpPath: 'values.health',
  displayName: data => String(data?.values?.identity?.handle || ''),
  avatar: data => data?.values?.identity?.avatar?.url || null,
  race: () => '',
  charClass: () => '',
  level: () => '',
  ac: () => null,
  abilities: () => [],
  statesValue: data => data?.values?.health?.conditions || [],
  subtitle(data) {
    return (data?.values?.roles || []).map(role =>
      `${RED_ROLES.find(r => r.key === role.key)?.name || role.key} · ${role.rank}`).join(' / ')
  },
  hp(data) {
    const values = data?.values
    if (!values?.health || !values?.stats) return null
    try {
      return { current: values.health.current, max: redHealthMaximum(values.stats.BODY, values.stats.WILL) }
    } catch { return null }
  },
  initiativeBonus: data => Number(data?.values?.stats?.REF) || 0,
  headerTitle(data) { return this.displayName(data) },
  listFields(data) {
    return { name: this.displayName(data) || '(без имени)', avatar: this.avatar(data),
      who: this.subtitle(data), lvl: '', hp: this.hp(data), ac: null }
  },
}
