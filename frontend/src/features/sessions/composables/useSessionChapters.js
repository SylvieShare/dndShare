import { nextTick, ref } from 'vue'
import {
  createChapter as apiCreateChapter,
  getChapters,
  renameChapter,
  setCurrentChapter,
} from '@/shared/api/sessionsApi'

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX']

export function romanNum(n) {
  const i = Number(n)
  return ROMAN[i] || String(i)
}

export function useSessionChapters({ session, sessionUuid, isDm }) {
  const chapterOpen = ref(false)
  const chapters = ref([])
  const chaptersLoading = ref(false)
  const currentChapter = ref(null)
  const newChapterName = ref('')
  const chapterCreating = ref(false)
  const editingChapterId = ref(null)
  const editingChapterName = ref('')
  const editingSaving = ref(false)
  const editInputEl = ref(null)

  function closeChapterMenu() {
    chapterOpen.value = false
    editingChapterId.value = null
    editingChapterName.value = ''
    newChapterName.value = ''
  }

  async function loadChapters() {
    if (chaptersLoading.value) return
    chaptersLoading.value = true
    try {
      const res = await getChapters(sessionUuid)
      chapters.value = res?.chapters ?? []
    } finally {
      chaptersLoading.value = false
    }
  }

  async function toggleChapterMenu() {
    if (!isDm.value) return
    if (chapterOpen.value) {
      closeChapterMenu()
      return
    }
    chapterOpen.value = true
    await loadChapters()
  }

  async function pickChapter(ch) {
    closeChapterMenu()
    if (!session.value || session.value.currentChapterId === ch.id) return
    session.value = { ...session.value, currentChapterId: ch.id }
    currentChapter.value = ch
    await setCurrentChapter(sessionUuid, ch.id).catch(() => {})
  }

  async function addChapter() {
    const name = newChapterName.value.trim()
    if (!name || chapterCreating.value) return
    chapterCreating.value = true
    try {
      const ch = await apiCreateChapter(sessionUuid, name)
      chapters.value = [...chapters.value, ch]
      session.value = { ...session.value, currentChapterId: ch.id }
      currentChapter.value = ch
      closeChapterMenu()
    } finally {
      chapterCreating.value = false
    }
  }

  function startChapterEdit(ch) {
    editingChapterId.value = ch.id
    editingChapterName.value = ch.name
    nextTick(() => {
      const el = Array.isArray(editInputEl.value) ? editInputEl.value[0] : editInputEl.value
      el?.focus?.()
      el?.select?.()
    })
  }

  function cancelChapterEdit() {
    editingChapterId.value = null
    editingChapterName.value = ''
  }

  async function commitChapterEdit() {
    const id = editingChapterId.value
    const name = editingChapterName.value.trim()
    if (!id || !name || editingSaving.value) return
    editingSaving.value = true
    try {
      const updated = await renameChapter(sessionUuid, id, name)
      chapters.value = chapters.value.map(c => c.id === id ? updated : c)
      if (currentChapter.value?.id === id) currentChapter.value = updated
      editingChapterId.value = null
      editingChapterName.value = ''
    } finally {
      editingSaving.value = false
    }
  }

  return {
    chapterOpen,
    chapters,
    chaptersLoading,
    currentChapter,
    newChapterName,
    chapterCreating,
    editingChapterId,
    editingChapterName,
    editingSaving,
    editInputEl,
    closeChapterMenu,
    loadChapters,
    toggleChapterMenu,
    pickChapter,
    addChapter,
    startChapterEdit,
    cancelChapterEdit,
    commitChapterEdit,
  }
}
