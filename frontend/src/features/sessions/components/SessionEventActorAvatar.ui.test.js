import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./SessionEventActorAvatar.vue', import.meta.url)), 'utf8')

describe('SessionEventActorAvatar', () => {
  it('uses projected actor artwork and character portrait fallback', () => {
    expect(source).toContain('props.event?.actorImageUrl')
    expect(source).toContain('pvAvatar({')
    expect(source).toContain('props.event?.actorSvg')
  })

  it('draws a dedicated scalable DM placeholder', () => {
    expect(source).toContain("kind === 'dm'")
    expect(source).toContain('<Crown')
    expect(source).toContain('<b>DM</b>')
    expect(source).toContain('.session-event-actor-avatar--dm')
  })
})
