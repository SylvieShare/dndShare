export function useSwipeToClose(panelRef, onClose) {
  let startX = null
  let startY = null
  let dir = null

  function onTouchStart(e) {
    startX = e.touches[0].clientX
    startY = e.touches[0].clientY
    dir = null
  }

  function onTouchMove(e) {
    if (startX === null) return
    const dx = e.touches[0].clientX - startX
    const dy = e.touches[0].clientY - startY
    if (!dir) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      dir = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
    }
    if (dir === 'h' && dx > 0) {
      const el = panelRef.value
      if (el) el.style.transform = `translateX(${dx}px)`
    }
  }

  function onTouchEnd(e) {
    const el = panelRef.value
    if (startX === null || dir !== 'h' || !el) {
      startX = null; dir = null; return
    }
    const dx = e.changedTouches[0].clientX - startX
    startX = null; dir = null
    if (dx > 80) {
      el.style.transition = 'transform 0.2s ease'
      el.style.transform = 'translateX(100%)'
      setTimeout(onClose, 200)
    } else {
      el.style.transition = 'transform 0.2s ease'
      el.style.transform = 'translateX(0)'
      setTimeout(() => { if (el) { el.style.transition = ''; el.style.transform = '' } }, 220)
    }
  }

  return { onTouchStart, onTouchMove, onTouchEnd }
}
