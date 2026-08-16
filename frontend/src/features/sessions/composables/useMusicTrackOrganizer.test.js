import { describe, expect, it } from 'vitest'
import { musicAlbumDropGroup, selectionRangeIds } from './useMusicTrackOrganizer'

const tracks = [{ id: 10 }, { id: 20 }, { id: 30 }, { id: 40 }]

describe('music track organizer', () => {
  it('selects an inclusive range in both directions', () => {
    expect(selectionRangeIds(tracks, 20, 40)).toEqual([20, 30, 40])
    expect(selectionRangeIds(tracks, 40, 20)).toEqual([20, 30, 40])
  })

  it('falls back to the target when the anchor is no longer visible', () => {
    expect(selectionRangeIds(tracks, 99, 30)).toEqual([30])
  })

  it('uses a dedicated sortable group for each album drop target', () => {
    expect(musicAlbumDropGroup(42)).toBe('music-album:42')
  })
})
