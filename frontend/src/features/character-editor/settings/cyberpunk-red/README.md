# Cyberpunk RED

Системный модуль Core 1.25 зарегистрирован как `CYBERPUNK_RED`.
Текущий контракт: [Cyberpunk RED](../../../../../../md/features/cyberpunk-red.md).

`creation.js` собирает промежуточный документ; единственная финализация перед
созданием выполняется `finishRedCreation` из `equipment.js`. Она проверяет
бюджеты, комплекты, Humanity, основания и слоты. `creationTables.js` содержит
проверенные таблицы десяти ролей. `roleChoices.js` проверяет специальные очки.

`derived.js`, `checks.js`, `gameplay.js`, `equipment.js`, `effects.js` и
`roleRules.js` владеют числовыми проекциями и редактируемыми состояниями.
Серверные броски/расход ресурсов находятся в `internal/cyberpunkred`,
транзакция и идемпотентная квитанция — в `internal/store/cyberpunk_roll.go`.
Не заменять серверный игровой бросок локальным d20/D&D PreparedCharacterD20.

Данные импортируются отдельной операторской MCP-командой. Полный текст книги
не входит в модуль; локальные источники перечислены в
[описи](../../../../../../docs/cyberpunk-red-sources.md).
