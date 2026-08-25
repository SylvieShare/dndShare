import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const settingsSource = readFileSync(fileURLToPath(new URL('./SettingsMenuTile.vue', import.meta.url)), 'utf8')
const statTileSource = readFileSync(fileURLToPath(new URL('../dnd/components/StatTileFace.vue', import.meta.url)), 'utf8')
const restSource = readFileSync(fileURLToPath(new URL('../dnd/DndRest.vue', import.meta.url)), 'utf8')
const levelSource = readFileSync(fileURLToPath(new URL('../dnd/DndLvl.vue', import.meta.url)), 'utf8')

describe('desktop utility tiles', () => {
  it('uses the same compact height for stats, rests, settings and level', () => {
    expect(statTileSource).toMatch(/\.stf \{[\s\S]*?height: 64px;/)
    expect(restSource).toMatch(/\.rest-tile \{[\s\S]*?min-height: 64px;/)
    expect(settingsSource).toMatch(/\.sm-tile \{[\s\S]*?min-height: 64px;/)
    expect(levelSource).toMatch(/\.lvl-tile \{ width: 100%; height: 100%; \}/)
  })

  it('shows only the centered settings menu control on the tile', () => {
    expect(settingsSource).not.toContain('class="sm-title"')
    expect(settingsSource).toMatch(/\.sm-tile \{[\s\S]*?align-items: center;[\s\S]*?justify-content: center;/)
    expect(settingsSource).toContain('class="sm-ic"')
    expect(settingsSource).toContain('<div class="sm-sub">меню</div>')
  })

  it('hides the save row when there is no active save', () => {
    expect(settingsSource).toContain("ctx.saveStatus === 'pending' || ctx.saveStatus === 'saving'")
    expect(settingsSource).not.toContain('Сохранено')
    expect(settingsSource).not.toContain('Ошибка сохранения')
  })
})
