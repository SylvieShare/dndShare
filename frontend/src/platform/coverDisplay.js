import { reactive } from 'vue'
import { registerPlugin } from '@capacitor/core'
import { isAndroid } from './storage'
import { prepareImageUpload, PORTRAIT_IMAGE_MAX_BYTES } from '../shared/lib/imageUpload'

const display = registerPlugin('CoverDisplay')
export const coverState = reactive({ foldable: false, supported: false, available: false, active: false, selected: false, busy: false, loading: false, autoplay: false, autoOwner: '', autoPhotoCount: 0, displayWidth: 0, displayHeight: 0, owner: '', photoUid: '', pendingOwner: '', pendingPhotoUid: '', reason: '', error: '' })
let generation = 0
let pendingRequest

export async function initializeCoverDisplay() {
  if (!isAndroid) return
  const update = state => Object.assign(coverState, state)
  await display.addListener('statusChanged', update)
  update(await display.getStatus())
}

export async function stopCover(owner) {
  if (pendingRequest?.owner === owner || coverState.pendingOwner === owner) {
    pendingRequest?.controller.abort()
    pendingRequest = null
    generation++
    coverState.busy = false
    coverState.pendingOwner = ''
    coverState.pendingPhotoUid = ''
  }
  if (isAndroid && owner) Object.assign(coverState, await display.hide({ owner: String(owner) }))
}

export async function startCoverSlideshow(owner, photos) {
  if (!isAndroid || !coverState.available || !owner) throw new Error(coverState.reason || 'Внешний экран сейчас недоступен')
  pendingRequest?.controller.abort()
  pendingRequest = null
  const request = ++generation
  coverState.busy = true
  coverState.pendingOwner = owner
  coverState.pendingPhotoUid = ''
  try {
    const status = await display.startSlideshow({ owner, photos: photoSources(photos) })
    if (request === generation) Object.assign(coverState, status)
  } finally {
    if (request === generation) { coverState.busy = false; coverState.pendingOwner = ''; coverState.pendingPhotoUid = '' }
  }
}

export async function pauseCoverSlideshow(owner) {
  if (!isAndroid || coverState.autoOwner !== owner && coverState.pendingOwner !== owner) return
  if (coverState.pendingOwner === owner) {
    generation++; coverState.busy = false; coverState.pendingOwner = ''; coverState.pendingPhotoUid = ''
  }
  Object.assign(coverState, await display.pauseSlideshow({ owner }))
}

export async function updateCoverGallery(owner, photos) {
  if (!isAndroid || !owner) return
  if (pendingRequest?.owner === owner && !photos.some(photo => photo.uid === pendingRequest.photoUid)) {
    const photoUid = pendingRequest.photoUid
    pendingRequest.controller.abort(); pendingRequest = null; generation++
    coverState.busy = false; coverState.pendingOwner = ''; coverState.pendingPhotoUid = ''
    Object.assign(coverState, await display.cancelPhoto({ owner, photoUid }))
  }
  if (coverState.autoplay && coverState.autoOwner === owner) Object.assign(coverState, await display.updateSlideshow({ owner, photos: photoSources(photos) }))
  else if (coverState.owner === owner && !photos.some(photo => photo.uid === coverState.photoUid)) await stopCover(owner)
}

function photoSources(photos) {
  return photos.map(({ uid, url, thumbnailUrl, imageId }) => ({ uid, url, thumbnailUrl: thumbnailUrl || '', imageId }))
}
export async function stopCoverPhoto(owner, photoUid) {
  if (pendingRequest?.owner === owner && pendingRequest.photoUid === photoUid || coverState.owner === owner && coverState.photoUid === photoUid) await stopCover(owner)
}

export async function showCoverPhoto(owner, photo) {
  if (!isAndroid || !coverState.available || !owner) throw new Error(coverState.reason || 'Внешний экран сейчас недоступен')
  pendingRequest?.controller.abort()
  const request = ++generation
  const controller = new AbortController()
  pendingRequest = { owner, photoUid: photo.uid, controller }
  coverState.busy = true
  coverState.pendingOwner = owner
  coverState.pendingPhotoUid = photo.uid
  try {
    let response
    try { response = await fetch(photo.url, { signal: controller.signal }) }
    catch (error) {
      if (error.name === 'AbortError') throw error
      response = await fetch(`/api/storage/images/${photo.imageId}`, { signal: controller.signal })
    }
    if (!response.ok) response = await fetch(`/api/storage/images/${photo.imageId}`, { signal: controller.signal })
    if (!response.ok) throw new Error('Не удалось загрузить фотографию для внешнего экрана')
    const blob = await response.blob()
    const resized = await prepareImageUpload(new File([blob], photo.name || 'photo.webp', { type: blob.type }), { maxBytes: PORTRAIT_IMAGE_MAX_BYTES, maxDimension: 2560 })
    if (request !== generation) return
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(resized)
    })
    if (request !== generation) return
    const status = await display.show({ owner, photoUid: photo.uid, data })
    if (request === generation) Object.assign(coverState, status)
  } catch (error) {
    if (request === generation && error.name !== 'AbortError') throw error
  } finally {
    if (pendingRequest?.controller === controller) { pendingRequest = null; coverState.busy = false; coverState.pendingOwner = ''; coverState.pendingPhotoUid = '' }
  }
}
