import { test } from 'node:test'
import assert from 'node:assert/strict'
import { expandDesignQuery } from './design-media.mjs'

test('layout aliases retain the exclusive phone and inclusive tablet boundaries', () => {
  assert.equal(expandDesignQuery('(--ui-phone)'), '(width < 600px)')
  assert.equal(expandDesignQuery('(--ui-tablet)'), '(600px <= width < 1200px)')
  assert.equal(expandDesignQuery('handbook-landing (--ui-desktop)'), 'handbook-landing (width >= 1200px)')
})
test('combined media preserves unrelated conditions and rejects unknown aliases', () => {
  assert.equal(expandDesignQuery('(--ui-compact) and (orientation: landscape)'), '(width < 1200px) and (orientation: landscape)')
  assert.equal(expandDesignQuery('(prefers-reduced-motion: reduce)'), '(prefers-reduced-motion: reduce)')
  assert.throws(() => expandDesignQuery('(--ui-missing)'), /Unknown design query/)
})
