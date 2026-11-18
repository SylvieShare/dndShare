import { RED_SKILLS_BY_KEY, RED_STATS } from '@/features/character-editor/settings/cyberpunk-red/catalogue'
import { redStartingGearError } from '@/features/character-editor/settings/cyberpunk-red/equipment'

const fields = {
  role: ['role', 'roleChoices'],
  lifepath: ['nativeLanguage'],
  method: ['method'],
  stats: ['stats'],
  skills: ['skills'],
  finish: ['name'],
}

const messages = {
  'role-required': 'Выберите роль',
  'method-required': 'Выберите способ создания',
  'role-choice-range': 'Специальность роли превышает допустимый ранг',
  'role-choice-budget': 'Превышен бюджет способности роли',
  'recipe-budget': 'Число рецептов превышает ранг фармацевтики',
  'name-required': 'Укажите имя персонажа',
  'native-language-required': 'Укажите родной язык, отличный от Стритсленга',
  'stat-rolls-required': 'Бросьте кубики для определения характеристик',
  'stat-table-mismatch': 'Перебросьте характеристики для выбранной роли',
  'stat-range': 'Значение характеристики должно быть от 2 до 8',
  'skill-minimum': 'Проверьте ранг обязательного навыка',
  'grant-minimum': 'Проверьте бесплатный ранг родного языка',
  'skill-range': 'Начальный ранг навыка должен быть от 0 до 6',
  'specialization-required': 'Укажите специализацию',
  'skill-not-allowed': 'Навык не входит в список этой роли',
  'template-skill-count': 'Проверьте навыки из стартового набора',
  'template-skill-mismatch': 'Навык отличается от стартового набора',
  'duplicate-skill': 'Повтор навыка или специализации',
}

export function redCreationErrorText(error) {
  if (error.code === 'stat-budget' || error.code === 'skill-budget') {
    const points = error.code === 'stat-budget' ? 'очка характеристик' : 'очков навыков'
    return `Распределите ${error.expected} ${points} (сейчас ${error.actual})`
  }
  const statKey = error.path.startsWith('stats.') ? error.path.split('.')[1] : ''
  const name = RED_SKILLS_BY_KEY[error.key]?.name || RED_STATS.find(stat => stat.key === statKey)?.name
  return [messages[error.code] || 'Проверьте выбор', name].filter(Boolean).join(': ')
}

export function redCreationStepError(step, draft, validation, items) {
  if (step === 'equipment' || step === 'cyberware') {
    return items.length ? redStartingGearError(draft, items, { equipmentOnly: step === 'equipment' }) : ''
  }
  const error = validation.errors.find(error => fields[step]?.includes(error.path.split('.')[0]))
  return error ? redCreationErrorText(error) : ''
}
