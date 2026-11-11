import { reactive } from 'vue'
import { registerPlugin } from '@capacitor/core'
import { isAndroid } from './storage'
import { prepareImageUpload, PORTRAIT_IMAGE_MAX_BYTES } from '../shared/lib/imageUpload'

const display = registerPlugin('CoverDisplay')
export const coverState = reactive({ foldable: false, available: false, active: false, busy: false, owner: '', photoUid: '', reason: '' })
let currentOwner = '', generation = 0
let pendingRequest

export async function initializeCoverDisplay() {
  if (!isAndroid) return
  const update = state => Object.assign(coverState, state)
  await display.addListener('statusChanged', update)
  update(await display.getStatus())
}

export function activateCoverOwner(owner) { currentOwner = String(owner || ''); generation++ }
export async function releaseCoverOwner(owner) {
  if (currentOwner === String(owner)) { currentOwner = ''; generation++ }
  await stopCover(owner)
}
export async function stopCover(owner) {
  if (pendingRequest?.owner === owner) {
    pendingRequest.controller.abort()
    pendingRequest = null
    generation++
    coverState.busy = false
  }
  if (isAndroid && owner) Object.assign(coverState, await display.hide({ owner: String(owner) }))
}
export async function stopCoverPhoto(owner, photoUid) {
  if (pendingRequest?.owner === owner && pendingRequest.photoUid === photoUid || coverState.owner === owner && coverState.photoUid === photoUid) await stopCover(owner)
}

export async function showCoverPhoto(owner, photo) {
  if (!isAndroid || !coverState.available || !owner || currentOwner !== owner) throw new Error(coverState.reason || 'Внешний экран сейчас недоступен')
  pendingRequest?.controller.abort()
  const request = ++generation
  const controller = new AbortController()
  pendingRequest = { owner, photoUid: photo.uid, controller }
  coverState.busy = true
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
    if (request !== generation || currentOwner !== owner) return
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(resized)
    })
    if (request !== generation || currentOwner !== owner) return
    const status = await display.show({ owner, photoUid: photo.uid, data })
    if (request === generation && currentOwner === owner) Object.assign(coverState, status)
  } catch (error) {
    if (error.name !== 'AbortError') throw error
  } finally {
    if (pendingRequest?.controller === controller) { pendingRequest = null; coverState.busy = false }
  }
}
