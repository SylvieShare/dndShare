import { describe, expect, it } from 'vitest'
import { RowActionMenu } from '@sylvieshare/share-ui'

describe('RowActionMenu package integration', () => {
  it('loads the shared action menu', () => {
    expect(RowActionMenu).toBeTruthy()
  })
})
