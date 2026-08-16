import { computed, ref, watch } from 'vue'
import { reorderByDrop, useSortable } from '@sylvieshare/share-ui'

const ALBUM_DROP_PREFIX = 'music-album:'

export function musicAlbumDropGroup(albumId) {
  return `${ALBUM_DROP_PREFIX}${albumId}`
}

export function selectionRangeIds(items, anchorId, targetId) {
  const from = items.findIndex(item => item.id === anchorId)
  const to = items.findIndex(item => item.id === targetId)
  if (from < 0 || to < 0) return [targetId]
  const [start, end] = from < to ? [from, to] : [to, from]
  return items.slice(start, end + 1).map(item => item.id)
}

export function useMusicTrackOrganizer({
  displayedTracks,
  selectedAlbumId,
  personalAlbums,
  canSort,
  musicStore,
  setStatus,
}) {
  const selectedTrackIds = ref([])
  const draggingTrackIds = ref([])
  const emptyAlbumItems = ref([])
  let selectionAnchorId = null

  const groups = { tracks: { items: displayedTracks } }
  watch(personalAlbums, albums => {
    const active = new Set(albums.map(album => musicAlbumDropGroup(album.id)))
    for (const name of Object.keys(groups)) {
      if (name !== 'tracks' && !active.has(name)) delete groups[name]
    }
    for (const name of active) groups[name] = { items: emptyAlbumItems }
  }, { immediate: true })

  const selectedTracks = computed(() => {
    const selected = new Set(selectedTrackIds.value)
    return musicStore.tracks.filter(track => selected.has(track.id))
  })

  const sortable = useSortable({
    groups,
    getKey: track => track.id,
    canDropAt: ({ toGroup }) => toGroup.startsWith(ALBUM_DROP_PREFIX)
      || (toGroup === 'tracks' && canSort.value && draggingTrackIds.value.length === 1),
    onDrop: async ({ fromIndex, toGroup, toIndex }) => {
      selectedTrackIds.value = draggingTrackIds.value.slice()
      selectionAnchorId = selectedTrackIds.value[0] || null
      if (toGroup.startsWith(ALBUM_DROP_PREFIX)) {
        const albumId = Number(toGroup.slice(ALBUM_DROP_PREFIX.length))
        const ids = draggingTrackIds.value.slice()
        if (!albumId || !ids.length) return
        try {
          await musicStore.addTracksToAlbum(albumId, ids)
          setStatus?.(`${ids.length === 1 ? 'Трек добавлен' : `Добавлено треков: ${ids.length}`} в альбом`)
        } catch {
          setStatus?.('Не удалось добавить треки в альбом')
        }
        return
      }
      if (!selectedAlbumId.value || fromIndex === toIndex || draggingTrackIds.value.length !== 1) return
      const ids = reorderByDrop(displayedTracks.value.map(track => track.id), fromIndex, toIndex)
      await musicStore.reorderAlbum(selectedAlbumId.value, ids).catch(() => {})
    },
  })

  const dragTargetAlbumId = computed(() => {
    const group = sortable.targetGroup.value || ''
    return group.startsWith(ALBUM_DROP_PREFIX)
      ? Number(group.slice(ALBUM_DROP_PREFIX.length))
      : null
  })

  function selectTrack(event, track) {
    if (sortable.dragging.value || sortable.shouldSuppressClick()) return
    const ids = selectedTrackIds.value
    if (event.shiftKey && selectionAnchorId != null) {
      selectedTrackIds.value = selectionRangeIds(displayedTracks.value, selectionAnchorId, track.id)
      return
    }
    if (event.metaKey || event.ctrlKey) {
      selectedTrackIds.value = ids.includes(track.id)
        ? ids.filter(id => id !== track.id)
        : [...ids, track.id]
      selectionAnchorId = track.id
      return
    }
    selectedTrackIds.value = [track.id]
    selectionAnchorId = track.id
  }

  function clearSelection() {
    selectedTrackIds.value = []
    selectionAnchorId = null
  }

  function startDrag(event, track) {
    draggingTrackIds.value = selectedTrackIds.value.includes(track.id)
      ? selectedTrackIds.value.slice()
      : [track.id]
    const index = displayedTracks.value.findIndex(item => item.id === track.id)
    if (index >= 0) sortable.startDrag(event, track, 'tracks', index)
  }

  function canDragTrack() {
    return personalAlbums.value.length > 0 || canSort.value
  }

  watch(displayedTracks, tracks => {
    const visible = new Set(tracks.map(track => track.id))
    selectedTrackIds.value = selectedTrackIds.value.filter(id => visible.has(id))
    if (selectionAnchorId != null && !visible.has(selectionAnchorId)) selectionAnchorId = null
  })
  watch(selectedAlbumId, clearSelection)

  return {
    sortable,
    selectedTrackIds,
    selectedTracks,
    dragTargetAlbumId,
    selectTrack,
    clearSelection,
    startDrag,
    canDragTrack,
  }
}
