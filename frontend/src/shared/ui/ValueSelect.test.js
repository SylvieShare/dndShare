import { describe, expect, it } from 'vitest'
import { ValueSelect } from '@sylvieshare/share-ui'

describe('ValueSelect package integration', () => {
  it('loads the shared select', () => {
    expect(ValueSelect).toBeTruthy()
  })
})
