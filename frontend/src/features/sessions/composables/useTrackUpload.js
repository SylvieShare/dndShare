import { ref } from 'vue'
import { probeDuration } from '@/features/sessions/lib/musicLibrary'

export function useTrackUpload({ musicStore, currentAlbumId }) {
  const dropActive = ref(false)
  const uploadStatus = ref('')
  const fileInputEl = ref(null)
  let dragCounter = 0

  function openFilePicker() {
    fileInputEl.value?.click()
  }

  function onDragEnter() {
    dragCounter += 1
    dropActive.value = true
  }

  function onDragLeave() {
    dragCounter = Math.max(0, dragCounter - 1)
    if (dragCounter === 0) dropActive.value = false
  }

  async function onFiles(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    await uploadFiles(files)
  }

  async function onDrop(e) {
    dropActive.value = false
    dragCounter = 0
    const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('audio/'))
    await uploadFiles(files)
  }

  async function uploadFiles(files) {
    if (!files.length) return
    for (const file of files) {
      if (file.size > 50 * 1024 * 1024) {
        uploadStatus.value = `«${file.name}» больше 50 МБ`
        continue
      }
      uploadStatus.value = `Загрузка «${file.name}»…`
      const durationSec = await probeDuration(file).catch(() => null)
      try {
        await musicStore.uploadTrack({
          file,
          name: file.name.replace(/\.[^.]+$/, ''),
          durationSec,
          albumId: currentAlbumId.value,
        })
        uploadStatus.value = `Загружен «${file.name}»`
      } catch {
        uploadStatus.value = `Ошибка загрузки «${file.name}»`
      }
    }
    setTimeout(() => { uploadStatus.value = '' }, 2500)
  }

  return {
    dropActive,
    uploadStatus,
    fileInputEl,
    openFilePicker,
    onDragEnter,
    onDragLeave,
    onFiles,
    onDrop,
  }
}
