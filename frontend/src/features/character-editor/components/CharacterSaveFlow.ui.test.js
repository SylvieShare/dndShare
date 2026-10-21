import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const toolbarSource = readFileSync(
  fileURLToPath(new URL('./CharEditorToolbar.vue', import.meta.url)),
  'utf8',
)
const toastSource = readFileSync(
  fileURLToPath(new URL('./CharacterSaveErrorToast.vue', import.meta.url)),
  'utf8',
)
const debounceSource = readFileSync(
  fileURLToPath(new URL('../composables/useSaveDebounce.js', import.meta.url)),
  'utf8',
)
const pageSource = readFileSync(
  fileURLToPath(new URL('../pages/ViewCharacter.vue', import.meta.url)),
  'utf8',
)
const modalSource = readFileSync(
  fileURLToPath(new URL('./CharacterSheetModal.vue', import.meta.url)),
  'utf8',
)

describe('character save feedback', () => {
  it('keeps idle success out of the menu', () => {
    expect(toolbarSource).toContain(
      "saveStatus === 'pending' || saveStatus === 'saving'",
    )
    expect(toolbarSource).not.toContain('Сохранено')
    expect(toolbarSource).not.toContain('Ошибка сохранения')
  })

  it('shows failures in a separate retryable alert on pages and sheet modals', () => {
    expect(toastSource).toContain('role="alert"')
    expect(toastSource).toContain('Не удалось сохранить лист')
    expect(toastSource).toContain("$emit('retry')")
    expect(pageSource).toContain('<CharacterSaveErrorToast')
    expect(modalSource).toContain('<CharacterSaveErrorToast')
    expect(debounceSource).toContain('retrySave')
  })
})
