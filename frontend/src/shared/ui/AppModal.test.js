import { describe, expect, it, vi } from 'vitest'

import { restoreFocus } from '@sylvieshare/share-ui'

describe('AppModal focus restoration', () => {
  it('restores focus without scrolling the page or a nested container', () => {
    const focus = vi.fn()

    restoreFocus({ focus })

    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  })
})
