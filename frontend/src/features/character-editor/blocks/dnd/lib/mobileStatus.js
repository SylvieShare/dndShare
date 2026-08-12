export function isInspirationActive(value) {
  if (value === true) return true
  return Number(value) > 0
}
