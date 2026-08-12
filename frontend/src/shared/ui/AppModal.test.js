import { describe, expect, it, vi } from 'vitest'

import { restoreFocus } from './AppModal.vue'

describe('AppModal focus restoration', () => {
  it('restores focus without scrolling the page or a nested container', () => {
    const focus = vi.fn()

    restoreFocus({ focus })

    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  })
})
