export const CALCULATION_VARIABLES = {
  casting_mod: 'Модификатор заклинательной характеристики',
  prof_bonus: 'Бонус мастерства',
  char_level: 'Уровень персонажа',
  cast_level: 'Круг заклинания',
  spell_dc: 'Сл заклинания',
  spell_attack: 'Бонус атаки заклинанием',
  str_mod: 'Модификатор Силы', dex_mod: 'Модификатор Ловкости',
  con_mod: 'Модификатор Телосложения', int_mod: 'Модификатор Интеллекта',
  wis_mod: 'Модификатор Мудрости', cha_mod: 'Модификатор Харизмы',
}

const FUNCTIONS = { min: Math.min, max: Math.max, floor: Math.floor, ceil: Math.ceil }

// A small arithmetic grammar; handbook formulas never execute JavaScript.
export function calculateRichFormula(formula, context = {}) {
  const source = String(formula || '').trim().replace(/[−–—]/g, '-').replace(/×/g, '*')
  const tokens = source.match(/\d+(?:\.\d+)?|[a-z_]+|[()+*/,\-]/g) || []
  if (!source || source.length > 400 || tokens.length > 150 || tokens.join('') !== source.replace(/\s/g, '')) {
    return { error: 'Некорректная формула', value: null }
  }
  let index = 0
  let missing = false
  const variables = new Set()
  function atom() {
    const token = tokens[index++]
    if (token === '+' || token === '-') return (token === '-' ? -1 : 1) * atom()
    if (token === '(') {
      const value = sum()
      if (tokens[index++] !== ')') throw new Error('Скобки не закрыты')
      return value
    }
    if (/^\d/.test(token || '')) return Number(token)
    if (Object.hasOwn(FUNCTIONS, token || '')) {
      if (tokens[index++] !== '(') throw new Error('После функции нужны скобки')
      const args = [sum()]
      while (tokens[index] === ',') { index++; args.push(sum()) }
      if (tokens[index++] !== ')') throw new Error('Скобки не закрыты')
      if (['floor', 'ceil'].includes(token) && args.length !== 1) throw new Error('Функции округления принимают одно значение')
      return FUNCTIONS[token](...args)
    }
    if (!Object.hasOwn(CALCULATION_VARIABLES, token || '')) throw new Error('Неизвестное значение в формуле')
    variables.add(token)
    const value = context[token]?.value
    if (value == null || !Number.isFinite(value)) { missing = true; return 0 }
    return value
  }
  function product() {
    let value = atom()
    while (tokens[index] === '*' || tokens[index] === '/') {
      const operator = tokens[index++]
      const right = atom()
      value = operator === '*' ? value * right : value / right
    }
    return value
  }
  function sum() {
    let value = product()
    while (tokens[index] === '+' || tokens[index] === '-') {
      const operator = tokens[index++]
      const right = product()
      value = operator === '+' ? value + right : value - right
    }
    return value
  }
  try {
    const value = sum()
    if (index !== tokens.length) throw new Error('Некорректная формула')
    if (!missing && !Number.isFinite(value)) throw new Error('Результат не является числом')
    return { value: missing ? null : value, error: '', variables: [...variables] }
  } catch (error) {
    return { value: null, error: error.message }
  }
}

export function richFormulaLabel(formula, context = {}, substitute = false) {
  return String(formula || '').replace(/[a-z_]+/g, key => {
    if (substitute && context[key]?.value != null) {
      const value = context[key].value
      return value < 0 ? `(${value})` : String(value)
    }
    return context[key]?.label || CALCULATION_VARIABLES[key] || ({ min: 'мин', max: 'макс', floor: 'округлить вниз', ceil: 'округлить вверх' })[key] || key
  }).replace(/\*/g, '×')
}
