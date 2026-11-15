# Архитектура Cyberpunk RED

Предложение. [Общий план](README.md).

## Границы модулей

| Область | Переиспользуем | Добавляем для RED |
| --- | --- | --- |
| Контекст | source/version, selection store, поиск | Cyberpunk/RED, `/rules/cyberpunk/red`, индекс кратких памяток |
| Персонаж | char UUID, template, versions, access control, media | definition, accessors, schema и validator |
| Лист | WorkspaceHeader, tabs, swipe, MorphSheet, меню, дневник | компоненты здоровья, SP, навыков, ролей, Humanity, NET |
| Создание | гостевой draft, восстановление после входа, modal/page | registry creators, RED state/validate/buildPayload |
| Справочник | item/type/schema, suggest, публикации, редактор | предметные схемы и renderer профили RED |
| Синхронизация | patches, mutationId, SSE, журнал | стабильные UID вложений/рангов/магазинов, миграции RED |
| Броски | транспорт, RNG, анимация, события | правила d10, вид события, серверная валидация |
| Android | общий Vue и SQLite | проверки WebView, IME, insets, fold/Back |

Предлагаемые новые владельцы: `settings/cyberpunk-red/` для accessors и чистых
расчётов, `components/sheet/cyberpunk-red/` для листа,
`features/character-list/.../cyberpunk-red/` для визарда,
`internal/cyberpunkred/` для серверных правил. Это проектируемые пути.
Не переносить игровые значения в share-ui: библиотеке принадлежат только
универсальные контролы. Не делать общий D&D/RED движок с десятками условных веток.

## Документ

Предлагаемая структура внутри существующего `char.data`:

```json
{
  "system": "cyberpunk-red",
  "schemaVersion": 1,
  "values": {
    "identity": {"handle": "Ника / STATIC", "avatar": null},
    "rules": {"profile": "core-2045", "contentSourceIds": [], "revision": "verified-manifest-id"},
    "creation": {"method": "complete", "profileKey": "standard", "complete": false},
    "stats": {"INT": 7, "REF": 8, "DEX": 6, "TECH": 7, "COOL": 5, "WILL": 6, "LUCK": 5, "MOVE": 6, "BODY": 6, "EMP": 6},
    "skills": [{"uid": "skill-1", "key": "handgun", "specialization": null, "rank": 6}],
    "roles": [{"uid": "role-1", "key": "netrunner", "rank": 4, "choices": {}}],
    "health": {"current": 40, "deathSavePenalty": 0, "injuries": [], "conditions": [], "addictions": []},
    "humanity": {"current": 52, "adjustments": []},
    "luck": {"current": 5},
    "inventory": {"spaces": [], "entries": []},
    "cyberware": {"installations": []},
    "netrunning": {"deckUid": null, "loadedPrograms": [], "encounter": null},
    "economy": {"cashEb": 350, "housingKey": null, "lifestyleKey": null, "ledger": []},
    "progression": {"ipAvailable": 0, "ipSpent": 0, "reputation": 0, "transactions": []},
    "lifepath": {"general": {}, "roleSpecific": {}, "contacts": [], "notes": ""}
  }
}
```

Пример объясняет форму; он не является проверенным результатом создания героя.
Ссылки на справочник используют item ID вместе со стабильным ключом импорта.
Ручные предметы имеют собственные данные и явное происхождение.

Хранятся: текущие HP/Humanity/LUCK, раны, текущее SP конкретной брони, патроны
магазина и запас, установленные опции, активные программы, деньги и IP.
Вычисляются: максимальные HP, порог ранений, эффективные характеристики,
база навыка, потолок Humanity, вместимость, модификаторы роли/экипировки.
Ручные корректировки — именованные записи с причиной, не перезапись результата.

У оружия различаются шаблон и экземпляр: `uid,itemId,quality,attachments,
magazine{ammoItemId,loaded},equipped,overrides`. У брони: локализация, исходный SP,
потерянный SP и штраф. У киберware: место, родительская установка, занятые слоты,
стоимость Humanity при установке и влияние на максимум; удаление импланта
не должно автоматически отменять прежнюю потерю текущей Humanity.

## Правила и команды

Каждая команда: `system,ruleRevision,kind,characterVersion,clientActionId,input`.
Сервер проверяет систему, права, ссылки, ресурсы и предусловия. Патроны/LUCK,
бросок и событие фиксируются одной транзакцией; повтор с тем же action ID
возвращает квитанцию без повторного списания. Клиентский итог не авторитетен.
Переход существующего D&D контракта делается отдельным проверенным шагом.

| Семейство | Что покрыть |
| --- | --- |
| Проверки | STAT + skill + d10, DV/противник, равенство, единичный дополнительный d10 на 1/10, LUCK, модификаторы, помощь, время |
| Инициатива | REF, модификаторы, порядок и ничьи; отдельный вид броска |
| Атаки | дальность/тип оружия, aimed shot, evasion eligibility, ROF, двуручность, перезарядка, качества и специальные режимы |
| Урон | бросок, локализация, SP, округление, ablation, ammo, критические травмы, shields, cover |
| Ближний бой | brawling, melee, martial arts, grapple, choke, throw, разоружение |
| Здоровье | состояния ранения, death save, стабилизация, лечение, травмы/quick fix/treatment, зависимости |
| Киберware | требования, вместимость, стороны/пары, установка/снятие, Humanity и терапия |
| NET | Interface checks, NET actions vs meat actions, deck slots, programs, Black ICE, architecture, jack in/out |
| Роли | все десять способностей, ранги, специализации, ресурсы, союзники/транспорт |
| Развитие | стоимость навыков ×1/×2, role ranks, multiclass restrictions, IP и журнал |
| Экономика | покупка/продажа, категории цены, repair/fabrication, housing/lifestyle, hustle |
| Мастер | NET architectures, авторские NPC, транспорт, трудности, выдача IP, скрытые сведения |

Полные таблицы и исключения сверяются с книгой. UI различает «рассчитано»,
«нужно решение ведущего» и «вручную». Наличие ручного редактора не означает
автоматизацию правила. Death save не проводится обычным skill-check обработчиком.

## Права, offline, публикация

- Публичный лист скрывает закрытые заметки, черновики и приватные сведения сессии.
  Просмотр не содержит мутаций; личный демонстрационный бросок не меняет героя.
- Редактирование offline использует существующую durable очередь. Авторитетные
  игровые команды требуют сети; локальный бросок помечается и не выдаётся за событие сессии.
- Конфликт установки, покупки или расхода ресурса требует разрешения; нельзя
  молча складывать числа. Reload/Back/resize сохраняют черновик и активную вкладку.
- Новая схема не интерпретируется старым клиентом как D&D. Capabilities/версия
  API определяют доступность RED; несовместимый клиент получает понятное состояние.
- Импорт книг — отдельная операция с dry run, отчётом, read-back и журналом.
  Startup SQL выполняет только DDL. Удаление пакета не удаляет пользовательские экземпляры.

## Связанные страницы

[План](README.md) · [Документ и синхронизация](../../md/document-sync.md) ·
[Справочник](../../md/features/handbook.md)
