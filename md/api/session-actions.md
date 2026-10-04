# API: магия и действия хроники

Концентрация, цели, сохранённые броски, шаги атак и создание предметов.

← [HTTP API](../api.md)

## Концентрация и эффект заклинания на себя

- `GET /api/char/{uuid}/concentration` → `{concentration: null | {id,spellId,name,startedAt,effects}}`.
  Эффект: `{uid,effectId,name,target}`. Чужое чтение скрывает список целей.
- `POST /api/char/{uuid}/concentration`: `{spellId,version,clientActionId}` начинает
  новое сотворение; `{endId,version,clientActionId}` завершает конкретное текущее.
  Ответ содержит `concentration`. Только владелец; устаревшая версия/сотворение — 409.
- `POST /api/char/{uuid}/spell-use`: `{spellId,optionKey,version,clientActionId}` →
  `{result}` применяет выбранный эффект на себя, связывает концентрацию и пишет хронику.
  Повтор clientActionId возвращает исходный результат, ячейка не списывается.
- `PATCH /api/sessions/{uuid}/settings` принимает также ключи `autoAccept.items`,
  `autoAccept.potions`, `autoAccept.spells` (bool), только от мастера. Они действуют
  на новые запросы; применение через мастера всё ещё требует выбора цели.

`settings.interactions.items`, `.potions`, `.spells` разрешают соответствующие
новые межперсонажные запросы (включены по умолчанию). Под каждым разрешением
показан его флаг автоподтверждения, только пока действие разрешено. Выключенный
вид нельзя отправить ни из меню, ни прямым API-запросом; сохранённое значение
автоподтверждения не обходит запрет. Применение на себя не запрещается. Уже
ожидающие запросы сохраняют возможность ответа.

## Сотворение с несколькими целями

`POST /api/char/{uuid}/spell-cast` принимает `version`, `clientActionId` (UUID),
`spellId`, `entryKey`, `optionKey`, `castLevel`, `pool`, `spendSlot`,
`sessionUuid`, `targets` (массив UUID персонажей либо `self`) и `dmCount`.
Без сессии разрешена только цель `self`. Число разных целей ограничено
`application_targets` заклинания. Ответ: `{transfers: [], self?: ApplicationResult}`.
Сервер проверяет владельца, версию листа, книгу/действующие дарованные заклинания,
круг, наличие ячейки и разрешения сессии. Транзакция расходует одну ячейку, применяет
эффект к себе и создаёт запросы остальным целям; автоподтверждение использует настройки
сессии. Каждый выбор для мастера становится отдельным запросом; повторная цель того
же сотворения отклоняется. Все эффекты связаны одной концентрацией.
Повтор `clientActionId` с тем же содержимым возвращает сохранённый результат; другое
содержимое вызывает конфликт. Общий бросок лечения сохраняется при первом применении
и повторяется для остальных целей. Отклонение запроса цели не возвращает ячейку.

Мастер получает снимки целей через `GET /api/sessions/{uuid}/save-targets` и
записывает спасброски через `POST /api/sessions/{uuid}/events/{eventId}/saves`
(`{results:[{target,result}]}`). Результаты дополняют исходное событие.
Контракт: [спасброски заклинаний](../features/spell-saving-throws.md).

MCP `handbook_item_reuse_icon(itemId, sourceItemId)` присваивает системной записи
тот же ID иконки изображения/SVG, что у другой системной записи. Файлы не
копируются, будущие изменения источника не наследуются; требуется право MCP write.
`handbook_item_reuse_cover(itemId, sourceItemId)` аналогично назначает тот же
ID обложки. Обе записи должны быть системными, у источника должна быть обложка.
Иконка, данные и связи записи не изменяются; прежний медиаобъект не удаляется.

## Применение результата хроники

`POST /api/sessions/{uuid}/impacts` — применение сохранённого урона/эффекта к нескольким целям либо прямого урона из боя. Только мастер; `clientActionId` обеспечивает повтор без двойного списания. [Контракт и исходы спасбросков](../features/session-damage.md).

## Цели атаки в хронике

`PUT /api/sessions/{uuid}/events/{eventId}/attack-targets` — только мастер;
`{targets:[{kind:"character",charUuid}]}` или NPC `{kind:"npc",encounterId,npcUid}`.
Максимум 50; `[]` очищает выбор. Возвращает `{event}` с `data.attackTargets`.
Принимаются только атаки с `data.attackRoll=true` и d20; сервер проверяет цели,
сохраняет их публичные идентичности без снимков листа и HP. Бросок не меняется.
Изменённые атаки входят в `updates` хроники. Подробнее: [применение урона](../features/session-damage.md).

Sheet initiative dice events include `data.sheetInitiative: true` with `data.result.total`. GET encounter projects new marked events for current session participants into reserve initiatives (creating a reserve row if needed). PUT encounter acknowledges these events and merges pending rolls against the previous roster. Active/dead participants keep their current initiative. `sheetInitiativeCursor` is the last acknowledged event id; an older cursor than persisted returns a conflict. Other dice events do not change preparation. The DM target pickers share `/save-targets` snapshots to derive AC and save formulas; their submitted identities omit `snapshot`, `hp` and display-only `armorClass`.

Chronicle `/save-targets` excludes players and NPCs with `position: "dead"` in
the latest non-deleted encounter. Zero HP alone does not exclude a creature.
Missing catalogue references in abilities or equipment do not contribute HP
bonuses and do not prevent the target roster from loading.
Attack-target, saving-throw and impact mutations validate new selections against
the same filtered roster; general `/application-targets` remains unchanged.

## Шаги атаки заклинанием

`POST /api/sessions/{uuid}/events/{eventId}/sequence` принимает `action`,
`revision`, `clientActionId` и параметры действия: `target`/`mode`,
`critical` или `typeId`. Действия: `target`, `hit`, `miss`, `type`, `next`,
`projectile`, `finish`. Выбор типа доступен автору и мастеру, остальные —
мастеру. Ответ `{event}` содержит обновлённую цепочку. Одинаковый UUID с
другим содержимым и устаревшая ревизия отклоняются. Запрос применения урона
`POST .../impacts` принимает необязательный `sequenceIndex`; тогда источник
урона — готовое попадание, применить его можно только к записанной цели.

## Создание вещей заклинанием

`POST /api/char/{uuid}/spell-cast` также принимает `creationKey` и необязательный
`createdCount`. Это вариант `item_creation` из справочника; `targets` должен
содержать только `self`, `optionKey` пустой. Количество проверяется по выбранной
ячейке, принимаются только видимые записи физических предметов. Ячейка,
созданные вещи и receipt фиксируются вместе. `self.createdItems[]` содержит
`itemId,name,uid,count,duration?`; тот же результат хранится в хронике.
При таком вызове лечение самого заклинания не применяется. Если предмет требует
концентрации, этот контракт пока отклоняет создание вместо несвязанного экземпляра.

## Связанные страницы

[Оглавление wiki](../README.md) · [HTTP API](../api.md) · [Магия и редакция персонажа](../features/character-editor/magic.md)
