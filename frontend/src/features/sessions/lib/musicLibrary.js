export function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

export function probeDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.src = url
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(Math.round(audio.duration))
    }
    audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error('probe')) }
  })
}
