import { fetchDelete, fetchGet, fetchPatch, fetchPost, fetchPut } from '@/shared/api/http'

// ---- tracks ----

export function getTracks() {
  return fetchGet('/music/tracks')
}

export function uploadTrack({ file, name, durationSec, albumId, onProgress }) {
  const form = new FormData()
  form.append('file', file)
  if (name) form.append('name', name)
  if (durationSec != null) form.append('durationSec', String(durationSec))
  if (albumId != null) form.append('albumId', String(albumId))
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/music/tracks')
    xhr.responseType = 'json'
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response)
      else reject(new Error(`HTTP ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('network'))
    xhr.send(form)
  })
}

export function renameTrack(id, name) {
  return fetchPatch(`/music/tracks/${id}`, { name })
}

export function deleteTrack(id) {
  return fetchDelete(`/music/tracks/${id}`)
}

export function getTrackUrl(id) {
  return fetchGet(`/music/tracks/${id}/url`)
}

// ---- albums ----

export function getAlbums() {
  return fetchGet('/music/albums')
}

export function createAlbum(data) {
  return fetchPost('/music/albums', data)
}

export function updateAlbum(id, data) {
  return fetchPatch(`/music/albums/${id}`, data)
}

export function deleteAlbum(id) {
  return fetchDelete(`/music/albums/${id}`)
}

export function getAlbumTracks(id) {
  return fetchGet(`/music/albums/${id}/tracks`)
}

export function addTrackToAlbum(albumId, trackId) {
  return fetchPost(`/music/albums/${albumId}/tracks`, { trackId })
}

export function removeTrackFromAlbum(albumId, trackId) {
  return fetchDelete(`/music/albums/${albumId}/tracks/${trackId}`)
}

export function setAlbumOrder(albumId, trackIds) {
  return fetchPut(`/music/albums/${albumId}/order`, { trackIds })
}

// ---- tags ----

export function getTags() {
  return fetchGet('/music/tags')
}

export function createTag(name) {
  return fetchPost('/music/tags', { name })
}

export function renameTag(id, name) {
  return fetchPatch(`/music/tags/${id}`, { name })
}

export function deleteTag(id) {
  return fetchDelete(`/music/tags/${id}`)
}

export function addTrackTag(trackId, name) {
  return fetchPost(`/music/tracks/${trackId}/tags`, { name })
}

export function attachTrackTag(trackId, tagId) {
  return fetchPost(`/music/tracks/${trackId}/tags/${tagId}`)
}

export function removeTrackTag(trackId, tagId) {
  return fetchDelete(`/music/tracks/${trackId}/tags/${tagId}`)
}

// ---- session state ----

export function getSessionMusic(uuid) {
  return fetchGet(`/sessions/${uuid}/music`)
}

export function saveSessionMusic(uuid, state) {
  return fetchPut(`/sessions/${uuid}/music`, state)
}

export function getSessionTrackUrl(uuid, trackId) {
  return fetchGet(`/sessions/${uuid}/music/tracks/${trackId}/url`)
}
