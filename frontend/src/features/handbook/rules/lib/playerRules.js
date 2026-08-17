import { PLAYER_RULE_ARTICLES, PLAYER_RULE_VERSION } from './playerRuleArticles'

export { PLAYER_RULE_ARTICLES, PLAYER_RULE_VERSION }

export function findPlayerRule(slug) {
  return PLAYER_RULE_ARTICLES.find(article => article.slug === slug) || null
}

export function normalizeRuleQuery(value) {
  return String(value || '')
    .toLocaleLowerCase('ru')
    .replaceAll('ё', 'е')
    .replace(/\s+/g, ' ')
    .trim()
}

function articleSearchText(article) {
  return normalizeRuleQuery([
    article.title,
    article.shortTitle,
    article.summary,
    ...(article.keywords || []),
    ...(article.questions || []),
  ].join(' '))
}

function articleMatch(article, normalized, words) {
  const haystack = articleSearchText(article)
  if (!words.every(word => haystack.includes(word))) return null

  const title = normalizeRuleQuery(`${article.title} ${article.shortTitle}`)
  const questions = normalizeRuleQuery((article.questions || []).join(' '))
  return (questions.includes(normalized) ? 100 : 0)
    + (title.includes(normalized) ? 50 : 0)
    + (haystack.includes(normalized) ? 20 : 0)
    + words.filter(word => title.includes(word)).length
}

function bestSectionMatch(article, normalized, words) {
  return (article.sections || []).map(section => {
    const title = normalizeRuleQuery(section.title)
    if (!words.every(word => title.includes(word))) return null
    const score = (title === normalized ? 220 : title.includes(normalized) ? 180 : 140)
      + words.length
    return { section, score }
  }).filter(Boolean).sort((left, right) => right.score - left.score)[0] || null
}

export function searchPlayerRuleEntries(query) {
  const normalized = normalizeRuleQuery(query)
  if (!normalized) return PLAYER_RULE_ARTICLES.map(article => ({ article, section: null }))

  const words = normalized.split(' ').filter(Boolean)
  return PLAYER_RULE_ARTICLES.map(article => {
    const sectionMatch = bestSectionMatch(article, normalized, words)
    const score = articleMatch(article, normalized, words)
    if (!sectionMatch && score == null) return null
    if (sectionMatch && (score == null || sectionMatch.score > score)) {
      return { article, section: sectionMatch.section, score: sectionMatch.score }
    }
    return { article, section: null, score }
  }).filter(Boolean).sort((left, right) => right.score - left.score || left.article.order - right.article.order)
}

export function searchPlayerRules(query) {
  return searchPlayerRuleEntries(query).map(result => result.article)
}
