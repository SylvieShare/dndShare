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
  Встроенного непроверенного профиля Core нет.

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

## Источники

[Исправленный официальный лист](https://rtalsoriangames.com/wp-content/uploads/2020/11/RTG-CPR-CharacterSheet-Fillable.pdf),
[Free Basic Rules](https://roll20.net/compendium/cpunk/Playing%20the%20Game),
[Core errata](https://rtalsoriangames.com/wp-content/uploads/2021/08/RTG-CPR-CoreBookErratav1.25.pdf).
Полная книга ещё нужна для сверки остальных правил и наполнения.

## Связанные страницы

[План и макеты](../../plans/cyberpunk-red/README.md) · [Опись PDF](../../docs/cyberpunk-red-sources.md) ·
[Оглавление](../README.md)
