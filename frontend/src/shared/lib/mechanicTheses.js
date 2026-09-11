/** Preserve rich references and dice; split only existing paragraphs and list items. */
export function mechanicTheses(html = '', lines = []) {
  const source = String(html || '').trim()
  let fragments = []
  if (source) {
    const blocks = [...source.matchAll(/<(p|ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    const remainder = source.replace(/<(p|ul|ol)\b[^>]*>[\s\S]*?<\/\1>/gi, '').trim()
    fragments = blocks.length && !remainder ? blocks.flatMap(block => block[1].toLowerCase() === 'p' ? [block[2]]
      : [...block[2].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(match => match[1])) : [source]
  }
  const rows = [...fragments.map(html => ({ html })), ...(lines || []).filter(Boolean).map(text => ({ text: String(text) }))]
  const seen = new Set()
  return rows.filter(row => {
    const plain = (row.text || row.html).replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').replace(/[.!;:\s]+$/g, '').trim().toLocaleLowerCase('ru')
    const key = /data-|<img\b|<svg\b|<table\b/i.test(row.html || '') ? `${plain}:${row.html}` : plain
    if (!key || seen.has(key)) return false
    seen.add(key); return true
  })
}
