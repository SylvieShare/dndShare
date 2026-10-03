// Server suggests use iconImageUrl + inline svg. Local picker options also
// accept iconUrl/icon, which may contain either an image URL or SVG markup.
export function resolveSuggestIcon(item) {
  const icon = item?.iconUrl || item?.icon_url || item?.svg || item?.icon || ''
  const inline = String(icon).trimStart().startsWith('<')
  return {
    iconImageUrl: item?.iconImageUrl || (inline ? '' : icon),
    svg: inline ? icon : '',
  }
}
