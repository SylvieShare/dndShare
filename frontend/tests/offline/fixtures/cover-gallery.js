import { createApp, h, ref } from 'vue'
import { registerPlugin } from '@capacitor/core'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'

const mode = new URLSearchParams(location.search).get('mode')
const status = { foldable: mode !== 'web', supported: mode !== 'unavailable', available: mode !== 'unavailable', selected: false, active: false, autoplay: false, autoOwner: '', owner: '', photoUid: '', reason: mode === 'unavailable' ? 'Прошивка не предоставляет доступ к внешнему экрану' : '' }
let update = () => {}
window.coverCalls = []
window.coverUpdate = patch => { Object.assign(status, patch); update({ ...status }) }
registerPlugin('CoverDisplay', { android: {
  addListener: async (_, listener) => { update = listener; return { remove() {} } },
  getStatus: async () => ({ ...status }),
  startSlideshow: async request => {
    window.coverCalls.push(['start', request]);
    window.coverUpdate({ autoplay: true, autoOwner: request.owner, owner: request.owner, selected: true, active: true, photoUid: request.photos[0].uid });
    return { ...status }
  },
  pauseSlideshow: async request => { window.coverCalls.push(['pause', request]); window.coverUpdate({ autoplay: false }); return { ...status } },
  updateSlideshow: async request => {
    window.coverCalls.push(['update', request]);
    if (!request.photos.some(photo => photo.uid === status.photoUid)) window.coverUpdate({ photoUid: request.photos[0]?.uid || '', active: !!request.photos.length });
    return { ...status }
  },
  hide: async () => { window.coverUpdate({ autoplay: false, selected: false, active: false, owner: '', photoUid: '' }); return { ...status } },
} })
const { initializeCoverDisplay } = await import('../../../src/platform/coverDisplay')
const { default: CharacterPhotoGallery } = await import('../../../src/features/character-editor/components/CharacterPhotoGallery.vue')
await initializeCoverDisplay()
const image = (width, height, fill) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${fill}"/></svg>`)
const photos = ref([
  { uid: 'portrait', imageId: 1, url: image(180, 300, '#876cbb'), name: 'Портрет' },
  { uid: 'landscape', imageId: 2, url: image(360, 180, '#577c9d'), name: 'Пейзаж' },
  { uid: 'portrait-2', imageId: 3, url: image(200, 300, '#94775e'), name: 'Другой портрет' },
])
createApp({ render: () => h('main', { style: 'max-width:800px' }, h(CharacterPhotoGallery, {
  block: { id: 'person_photos' }, value: photos.value, 'onUpdate:value': (_, value) => { photos.value = value },
})) }).provide('charCtx', { ownerMode: true, characterUuid: 'character' }).mount('#app')
