export const pointChapterIds = point => [point?.chapterId, ...(point?.additionalChapterIds || [])].filter(Boolean)
export const chapterLinksPatch = ids => ({ chapterId: ids[0] || null, additionalChapterIds: ids.slice(1) })
export const linkedItems = (items, ids) => ids.map(id => items.find(item => item.id === id)).filter(Boolean)
