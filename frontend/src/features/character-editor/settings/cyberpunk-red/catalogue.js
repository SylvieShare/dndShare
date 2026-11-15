// Stable mechanical keys. Translation labels remain separate from identity.
// Source: the corrected official Core character sheet and Core errata v1.25.
export const RED_SYSTEM = 'cyberpunk-red'
export const RED_TEMPLATE = 'CYBERPUNK_RED'
export const RED_STATS = Object.freeze([
  ['INT', 'Интеллект'], ['REF', 'Реакция'], ['DEX', 'Ловкость'],
  ['TECH', 'Техника'], ['COOL', 'Хладнокровие'], ['WILL', 'Воля'],
  ['LUCK', 'Удача'], ['MOVE', 'Движение'], ['BODY', 'Телосложение'], ['EMP', 'Эмпатия'],
].map(([key, name]) => Object.freeze({ key, name })))

const skills = [
  ['concentration', 'Сосредоточение', 'WILL', 'awareness'],
  ['conceal-reveal-object', 'Спрятать / обнаружить предмет', 'INT', 'awareness'],
  ['lip-reading', 'Чтение по губам', 'INT', 'awareness'],
  ['perception', 'Внимательность', 'INT', 'awareness'],
  ['tracking', 'Выслеживание', 'INT', 'awareness'],
  ['athletics', 'Атлетика', 'DEX', 'body'],
  ['contortionist', 'Гибкость', 'DEX', 'body'],
  ['dance', 'Танец', 'DEX', 'body'],
  ['endurance', 'Выносливость', 'WILL', 'body'],
  ['resist-torture-drugs', 'Сопротивление пыткам и препаратам', 'WILL', 'body'],
  ['stealth', 'Скрытность', 'DEX', 'body'],
  ['drive-land-vehicle', 'Вождение наземного транспорта', 'REF', 'control'],
  ['pilot-air-vehicle', 'Пилотирование воздушного транспорта', 'REF', 'control', 2],
  ['pilot-sea-vehicle', 'Управление водным транспортом', 'REF', 'control'],
  ['riding', 'Верховая езда', 'REF', 'control'],
  ['accounting', 'Бухгалтерия', 'INT', 'education'],
  ['animal-handling', 'Обращение с животными', 'INT', 'education'],
  ['bureaucracy', 'Бюрократия', 'INT', 'education'],
  ['business', 'Бизнес', 'INT', 'education'],
  ['composition', 'Сочинительство', 'INT', 'education'],
  ['criminology', 'Криминология', 'INT', 'education'],
  ['cryptography', 'Криптография', 'INT', 'education'],
  ['deduction', 'Дедукция', 'INT', 'education'],
  ['education', 'Образование', 'INT', 'education'],
  ['gamble', 'Азартные игры', 'INT', 'education'],
  ['language', 'Язык', 'INT', 'education', 1, 'language'],
  ['library-search', 'Поиск информации', 'INT', 'education'],
  ['local-expert', 'Знание местности', 'INT', 'education', 1, 'area'],
  ['science', 'Наука', 'INT', 'education', 1, 'science'],
  ['tactics', 'Тактика', 'INT', 'education'],
  ['wilderness-survival', 'Выживание', 'INT', 'education'],
  ['brawling', 'Рукопашный бой', 'DEX', 'fighting'],
  ['evasion', 'Уклонение', 'DEX', 'fighting'],
  ['martial-arts', 'Боевые искусства', 'DEX', 'fighting', 2, 'martial-art'],
  ['melee-weapon', 'Холодное оружие', 'DEX', 'fighting'],
  ['acting', 'Актёрское мастерство', 'COOL', 'performance'],
  ['play-instrument', 'Игра на инструменте', 'TECH', 'performance', 1, 'instrument'],
  ['archery', 'Стрельба из лука', 'REF', 'ranged'],
  ['autofire', 'Автоматический огонь', 'REF', 'ranged', 2],
  ['handgun', 'Пистолеты', 'REF', 'ranged'],
  ['heavy-weapons', 'Тяжёлое оружие', 'REF', 'ranged', 2],
  ['shoulder-arms', 'Длинноствольное оружие', 'REF', 'ranged'],
  ['bribery', 'Подкуп', 'COOL', 'social'],
  ['conversation', 'Беседа', 'EMP', 'social'],
  ['human-perception', 'Проницательность', 'EMP', 'social'],
  ['interrogation', 'Допрос', 'COOL', 'social'],
  ['persuasion', 'Убеждение', 'COOL', 'social'],
  ['personal-grooming', 'Уход за внешностью', 'COOL', 'social'],
  ['streetwise', 'Знание улиц', 'COOL', 'social'],
  ['trading', 'Торговля', 'COOL', 'social'],
  ['wardrobe-style', 'Гардероб и стиль', 'COOL', 'social'],
  ['air-vehicle-tech', 'Авиационная техника', 'TECH', 'technique'],
  ['basic-tech', 'Базовая техника', 'TECH', 'technique'],
  ['cybertech', 'Кибертехника', 'TECH', 'technique'],
  ['demolitions', 'Взрывотехника', 'TECH', 'technique', 2],
  ['electronics-security-tech', 'Электроника и безопасность', 'TECH', 'technique', 2],
  ['first-aid', 'Первая помощь', 'TECH', 'technique'],
  ['forgery', 'Подделка', 'TECH', 'technique'],
  ['land-vehicle-tech', 'Наземная техника', 'TECH', 'technique'],
  ['paint-draw-sculpt', 'Изобразительное искусство', 'TECH', 'technique'],
  ['paramedic', 'Парамедицина', 'TECH', 'technique', 2],
  ['photography-film', 'Фото и видеосъёмка', 'TECH', 'technique'],
  ['pick-lock', 'Взлом замков', 'TECH', 'technique'],
  ['pick-pocket', 'Карманная кража', 'TECH', 'technique'],
  ['sea-vehicle-tech', 'Судовая техника', 'TECH', 'technique'],
  ['weaponstech', 'Оружейная техника', 'TECH', 'technique'],
]

export const RED_SKILLS = Object.freeze(skills.map(
  ([key, name, statKey, groupKey, costMultiplier = 1, specializationKind = null]) =>
    Object.freeze({ key, name, statKey, groupKey, costMultiplier, specializationKind }),
))
export const RED_SKILLS_BY_KEY = Object.freeze(Object.fromEntries(RED_SKILLS.map(s => [s.key, s])))
export const RED_SKILL_GROUPS = Object.freeze({
  awareness: 'Восприятие', body: 'Тело', control: 'Управление', education: 'Знания',
  fighting: 'Ближний бой', performance: 'Выступление', ranged: 'Стрельба',
  social: 'Общение', technique: 'Техника',
})

export const RED_ROLES = Object.freeze([
  ['rockerboy', 'Рокер', 'Rockerboy'], ['solo', 'Соло', 'Solo'],
  ['netrunner', 'Нетраннер', 'Netrunner'], ['tech', 'Техник', 'Tech'],
  ['medtech', 'Медтехник', 'Medtech'], ['media', 'Медиа', 'Media'],
  ['lawman', 'Законник', 'Lawman'], ['exec', 'Корпорат', 'Exec'],
  ['fixer', 'Фиксер', 'Fixer'], ['nomad', 'Кочевник', 'Nomad'],
].map(([key, name, originalName]) => Object.freeze({ key, name, originalName })))
