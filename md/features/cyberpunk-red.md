# Cyberpunk RED: состояние интеграции

Действующая граница реализации: подготовлен независимый frontend-модуль
справочных ключей и чистых проверок. Он ещё не зарегистрирован в выборе систем
и не подключён к серверным игровым командам. Полная интеграция не выпущена.

## Реализованный модуль

- [catalogue.js](../../frontend/src/features/character-editor/settings/cyberpunk-red/catalogue.js)
  задаёт 10 характеристик, 66 типов навыков, их группы/характеристики/×2,
  параметризуемые специализации и 10 ролей. Русские названия — рабочий глоссарий.
- [checks.js](../../frontend/src/features/character-editor/settings/cyberpunk-red/checks.js)
  принимает результаты кубиков и возвращает результат skill check, opposed check,
  инициативы и предварительный расчёт обычного попадания в тело.
- [creationValidation.js](../../frontend/src/features/character-editor/settings/cyberpunk-red/creationValidation.js)
  проверяет распределение характеристик/навыков по явно переданному профилю.
- [creation.js](../../frontend/src/features/character-editor/settings/cyberpunk-red/creation.js)
  использует сверенный профиль Core: 62 STAT, 86 skill points, пределы 2–8/6,
  бесплатный родной язык, ролевые таблицы и отдельные стратегии методов.
  Базовая сборка оставляет `creation.complete=false` до финализации экипировки
  и ролевых выборов. Она ещё не подключена к продуктовому созданию.
- [derived.js](../../frontend/src/features/character-editor/settings/cyberpunk-red/derived.js)
  считает HP, пороги ранений, Humanity и текущую EMP.
- Подготовлены definition и semantic accessors, регистрация публичного шаблона
  и рендер листа ещё не включены.

Функции не изменяют документ, не списывают LUCK/патроны и не записывают события.
Они не являются заменой серверной авторизации и атомарной команды. Расчёт
попадания не поддерживает headshot, shield, cover, специальный боеприпас или NET.
Эти случаи не должны вызывать его под видом полной поддержки боевой системы.

## Проверки

[Изолированные сценарии](../../frontend/tests/game-mechanics/cyberpunk-red.test.mjs):
из корня `node --test frontend/tests/game-mechanics/cyberpunk-red.test.mjs`.
Проверяются границы DV, дополнительные кости, opposed tie, LUCK, SP/округление/
износ, критический бонус, специализации, двойная стоимость, free grants,
обязательные навыки и некорректные входы.

[Создание](../../frontend/tests/game-mechanics/cyberpunk-red-creation.test.mjs):
`node --test frontend/tests/game-mechanics/cyberpunk-red-creation.test.mjs` —
35 сценариев, включая 30 сочетаний роли и метода на уровне STAT/skills,
сохранение ранга роли, native-language grant и отсутствие полей D&D.

## Источники

[Исправленный официальный лист](https://rtalsoriangames.com/wp-content/uploads/2020/11/RTG-CPR-CharacterSheet-Fillable.pdf),
[Free Basic Rules](https://roll20.net/compendium/cpunk/Playing%20the%20Game),
[Core errata](https://rtalsoriangames.com/wp-content/uploads/2021/08/RTG-CPR-CoreBookErratav1.25.pdf).
Полная книга получена от пользователя; см. опись ниже. Её наличие снимает
ограничение доступа, но оставшиеся механики и каталог ещё требуют реализации.

## Связанные страницы

[План и макеты](../../plans/cyberpunk-red/README.md) · [Опись PDF](../../docs/cyberpunk-red-sources.md) ·
[Оглавление](../README.md)
