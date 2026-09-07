import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as musicApi from '@/shared/api/musicApi'

import { useMusicPlayback } from '@/features/sessions/composables/useMusicPlayback'

export const useMusicStore = defineStore('music', () => {
  // ---- library ----
  const tracks = ref([])
  const albums = ref([])
  const tags = ref([])
  const libraryLoaded = ref(false)
  const libraryLoading = ref(false)

  async function ensureLibrary(force = false) {
    if (libraryLoaded.value && !force) return
    if (libraryLoading.value) return
    libraryLoading.value = true
    try {
      const [t, a, g] = await Promise.all([musicApi.getTracks(), musicApi.getAlbums(), musicApi.getTags()])
      tracks.value = t?.tracks ?? []
      albums.value = a?.albums ?? []
      tags.value = g?.tags ?? []
      libraryLoaded.value = true
    } finally {
      libraryLoading.value = false
    }
  }

  function trackById(id) {
    return tracks.value.find(t => t.id === id) || null
  }
  function albumById(id) {
    return albums.value.find(a => a.id === id) || null
  }

  async function uploadTrack(args) {
    const t = await musicApi.uploadTrack(args)
    tracks.value = [t, ...tracks.value.filter(x => x.id !== t.id)]
    if (args.albumId) await refreshAlbums()
    return t
  }
  async function renameTrack(id, name) {
    const t = await musicApi.renameTrack(id, name)
    tracks.value = tracks.value.map(x => x.id === id ? t : x)
  }
  async function deleteTrack(id) {
    await deleteTracks([id])
  }
  async function deleteTracks(trackIds) {
    const ids = [...new Set(trackIds)]
    await Promise.all(ids.map(id => musicApi.deleteTrack(id)))
    const deleted = new Set(ids)
    tracks.value = tracks.value.filter(x => !deleted.has(x.id))
    await refreshAlbums()
  }
  async function createAlbum(data) {
    const a = await musicApi.createAlbum(data)
    albums.value = [...albums.value, a]
    return a
  }
  async function updateAlbum(id, data) {
    const a = await musicApi.updateAlbum(id, data)
    albums.value = albums.value.map(x => x.id === id ? a : x)
  }
  async function deleteAlbum(id) {
    await musicApi.deleteAlbum(id)
    albums.value = albums.value.filter(x => x.id !== id)
    tracks.value = tracks.value.map(t => ({ ...t, albumIds: (t.albumIds || []).filter(aid => aid !== id) }))
  }
  async function addTrackToAlbum(albumId, trackId) {
    await addTracksToAlbum(albumId, [trackId])
  }
  async function addTracksToAlbum(albumId, trackIds) {
    const ids = [...new Set(trackIds)]
    await Promise.all(ids.map(trackId => musicApi.addTrackToAlbum(albumId, trackId)))
    const added = new Set(ids)
    tracks.value = tracks.value.map(track => added.has(track.id) && !(track.albumIds || []).includes(albumId)
      ? { ...track, albumIds: [...(track.albumIds || []), albumId] }
      : track)
    await refreshAlbums()
    await loadAlbumTracks(albumId)
  }
  async function removeTrackFromAlbum(albumId, trackId) {
    await removeTracksFromAlbum(albumId, [trackId])
  }
  async function removeTracksFromAlbum(albumId, trackIds) {
    const ids = [...new Set(trackIds)]
    await Promise.all(ids.map(trackId => musicApi.removeTrackFromAlbum(albumId, trackId)))
    const removed = new Set(ids)
    tracks.value = tracks.value.map(track => removed.has(track.id)
      ? { ...track, albumIds: (track.albumIds || []).filter(id => id !== albumId) }
      : track)
    albumOrder.value = { ...albumOrder.value, [albumId]: (albumOrder.value[albumId] || []).filter(id => !removed.has(id)) }
    await refreshAlbums()
  }
  // albumId -> ordered list of track ids
  const albumOrder = ref({})
  async function loadAlbumTracks(albumId) {
    const res = await musicApi.getAlbumTracks(albumId)
    const list = res?.tracks ?? []
    albumOrder.value = { ...albumOrder.value, [albumId]: list.map(t => t.id) }
  }
  async function reorderAlbum(albumId, trackIds) {
    albumOrder.value = { ...albumOrder.value, [albumId]: trackIds.slice() }
    await musicApi.setAlbumOrder(albumId, trackIds)
  }
  async function addTrackTag(trackId, name) {
    const t = await musicApi.addTrackTag(trackId, name)
    tracks.value = tracks.value.map(x => x.id === trackId ? t : x)
    if (!tags.value.find(g => g.name.toLowerCase() === name.trim().toLowerCase())) {
      const refreshed = await musicApi.getTags()
      tags.value = refreshed?.tags ?? tags.value
    }
  }
  async function attachTrackTag(trackId, tagId) {
    await attachTracksTag([trackId], tagId)
  }
  async function attachTracksTag(trackIds, tagId) {
    const updated = await Promise.all([...new Set(trackIds)].map(trackId => musicApi.attachTrackTag(trackId, tagId)))
    const byId = new Map(updated.map(track => [track.id, track]))
    tracks.value = tracks.value.map(track => byId.get(track.id) || track)
  }
  async function removeTrackTag(trackId, tagId) {
    await removeTracksTag([trackId], tagId)
  }
  async function removeTracksTag(trackIds, tagId) {
    const ids = [...new Set(trackIds)]
    await Promise.all(ids.map(trackId => musicApi.removeTrackTag(trackId, tagId)))
    const changed = new Set(ids)
    tracks.value = tracks.value.map(track => changed.has(track.id)
      ? { ...track, tags: (track.tags || []).filter(tag => tag.id !== tagId) }
      : track)
  }
  async function createTag(name) {
    const tag = await musicApi.createTag(name)
    if (!tags.value.find(g => g.id === tag.id)) tags.value = [...tags.value, tag]
    return tag
  }
  async function renameTag(id, name) {
    const tag = await musicApi.renameTag(id, name)
    tags.value = tags.value.map(g => g.id === id ? tag : g)
    tracks.value = tracks.value.map(t => ({
      ...t,
      tags: (t.tags || []).map(g => g.id === id ? tag : g),
    }))
  }
  async function deleteTag(id) {
    await musicApi.deleteTag(id)
    tags.value = tags.value.filter(g => g.id !== id)
    tracks.value = tracks.value.map(t => ({
      ...t,
      tags: (t.tags || []).filter(g => g.id !== id),
    }))
  }
  async function refreshAlbums() {
    const a = await musicApi.getAlbums()
    albums.value = a?.albums ?? []
  }

  const playback = useMusicPlayback({ tracks, trackById, albumById })

  return {
    // library state
    tracks, albums, tags, libraryLoaded, libraryLoading, albumOrder,
    ensureLibrary, trackById, albumById,
    uploadTrack, renameTrack, deleteTrack, deleteTracks,
    createAlbum, updateAlbum, deleteAlbum,
    addTrackToAlbum, addTracksToAlbum, removeTrackFromAlbum, removeTracksFromAlbum,
    loadAlbumTracks, reorderAlbum,
    addTrackTag, attachTrackTag, attachTracksTag, removeTrackTag, removeTracksTag,
    createTag, renameTag, deleteTag,
    ...playback,
  }
})
