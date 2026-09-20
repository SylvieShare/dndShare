# Sessions

Frontend: `frontend/src/features/sessions`. Backend:
`internal/web/sessions.go`, `session_scenes.go`, `session_world.go`, `music.go`
and matching store files.

## Pages and access

- `/sessions` — campaigns available to the user.
- `/sessions/:uuid` — DM workspace or the participant-facing session page,
  depending on the current user's role.
- `/join/:code` — invitation flow.

## Игровой стол

Вкладка мастера «Карта» добавляет карты из библиотеки `/maps`, расставляет
жетоны игроков и существ encounter, управляет зонами тумана и интерактивными
объектами. Копия карты, двери, расстановка и видимость сохраняются в сессии.
После первого открытия вкладка сохраняется при переходах к сюжету и бою.
Трансляция `/map-screen/:code` имеет отдельную камеру и калибровку под
физические миниатюры; основной экран сессии не переключается.
Подробности: [игровые карты](maps.md). Материалы типа map остаются раздаточными
изображениями; они не заменяют библиотеку игровых карт и не преобразуются
в неё автоматически.

A session has DM/participant permissions, current chapter, participants,
encounter, lifecycle status and synchronized music state. Owner-only actions are checked on the
server, not only hidden in UI.

The session status is `active` («Активен»), `stopped` («Остановлен») or
`completed` («Завершён»), initially `stopped`. The DM changes it through the
icon menu to the left of the session name and arc. Status changes persist on the
server and refresh through the session live stream; they do not start/stop combat,
music or timers. Active owned sessions appear as shortcuts with a dashed purple
border near the top of the global desktop sidebar and on the left of the mobile
header. The navigation reloads them on sign-in, navigation (with a 30-second cache)
and window focus, and updates immediately after changes on the session page.
Shortcuts are cleared when the account changes.

The DM can open every participant’s character sheet even when `publicVisible`
is disabled. This applies while the character belongs to a non-deleted session
owned by that DM. Other players need both the session’s `players.openSheets` permission and a public link to open someone else’s sheet from the roster. This controls session navigation; it does not revoke an independently shared public URL.

Opening a session as a participant renders a separate player composition instead
of the DM canvas and tool rails. The page places the campaign context first, then
uses the current chapter image, arc and title as the main visual block beside a
responsive group roster. Every roster row shows the canonical character icon,
name and the permitted class/race subtitle, plus HP when enabled. Characters with `canOpenSheet` have a link to their sheet; the
current player's own sheet remains accessible even when it is private. The view
folds into one column on mobile and follows the session live stream so participant,
campaign and current-chapter changes refresh without opening the DM-only APIs.
Session cards now open this role-aware page for both roles rather than sending a
participant directly to their character sheet.

`GET /api/sessions` returns session cards with participant briefs and current
chapter, including that chapter's image URL and focal point. The list renders
each campaign as a full-width tile: the current chapter image and label form the
cover, while the campaign name, description, system, user role, participants
and last-change time stay in the content area. Without a selected chapter the
cover uses the campaign initial; on narrow screens it moves above the content.
For sessions where the current user is a participant, the response also
includes the owner's login and the tile shows it as the DM name.
Participant media for the list prefers the character's independent
`iconImageUrl` and falls back to the setting avatar in canonical character data;
`char_template.path_values_for_list` does not exist.
When the whole list or the selected ownership filter is empty, the page shows
a two-column start state: one card opens session creation and the other accepts
an invitation code inline. On narrow screens the cards stack vertically.

## Настройки видимости игроков

Мастер открывает отдельную вкладку «Настройки». Настройки сохраняются
на сервере в единой колонке `session.settings` (`jsonb`) с разделами `players` и `combat` и синхронизируются через SSE `session`:

- `players.seeClass` — класс других игроков (по умолчанию включён).
- `players.seeRace` — раса других игроков (по умолчанию включена).
- `players.seeHp` — текущие, максимальные и временные HP других игроков (по умолчанию выключены).
- `players.openSheets` — кнопки и пункты меню для перехода на чужие публичные листы (по умолчанию включены).

`PATCH /api/sessions/{uuid}/settings` принимает `{key, value}` и доступен только
владельцу сессии. Изменение одного флага использует `jsonb_set` по разрешённому пути и не перезаписывает остальные разделы, включая будущие поля.
`GET /api/sessions/{uuid}` возвращает `canOpenSheet` для каждого участника и
ограниченный `data.values` для других игроков: имя, аватар и разрешённые поля.
Ссылки классов/рас содержат только имена; HP не включают описания бонусов.
Собственные персонажи и участники сессии мастера сохраняют полный доступ.
Общий `/chars/poll` выдаёт полные данные только владельцу, мастеру или читателю
публичного листа; приватные данные соигроков через него недоступны. Игрок обновляет
состав группы через API сессии, включая изменения персонажей в live-потоке.
В поповере «Другие игроки» на листе те же данные и пункт «Открыть лист» следуют
серверному разрешению; чат и игры остаются доступны независимо от этого флага.

В этой же вкладке — `combat.autoRollNpcHp`, автоматический бросок HP существ
(по умолчанию выключен), и повтор обучения. Все пять параметров общие для сессии;
`localStorage` не используется. Содержимое вкладки центрируется в общей области
`SessionTabWorkspace`, максимальная ширина — 760px. Настройки видимости не меняют оформление анонимной трансляции:
у экрана показа свои параметры.

## Participant display

`lib/participantView.js` is the only participant adapter. It resolves the
setting from `templateId` and delegates name/avatar/subtitle/level/HP/AC to the
same accessors used by character cards and the sheet. Its avatar projection
first checks `iconImageUrl`, then uses the setting accessor. Entry contract is
`{templateId,data,iconImageUrl?}`. If the setting is not registered, there is no
path-map fallback.

`ViewSession` and join pages ensure the template store before rendering. In the
session workspace, `CharacterCreateWizardModal` presents the full D&D creation
wizard as a fullscreen modal. Its result carries an explicit rules
`sourceVersionId`, is attached to the current session and refreshes the
participant rail; the modal then closes without opening the new sheet or
changing the route. The invitation flow continues to use the compact
`CharacterCreateModal` and opens the joined character after creation. The
character sheet opened from the participant rail uses the shared dotted app
canvas; its teleported portrait action menu stays above the fullscreen sheet.
The DM can replace a participant's character icon from that sheet; the backend
rechecks that the character still belongs to a session owned by the acting DM.
A character can belong to at most one session. Both invitation entry points show
a confirmation naming the previous session before a transfer; confirmation
sends an explicit replacement flag, and the backend atomically removes the old
membership before creating the new one. A database unique constraint on
`session_participant.char_id` enforces the rule for every caller.

The session participant rail has no shared backing surface: each participant is
an individual interactive `BaseTile`. Clicking it opens `RowActionMenu` with an
icon-labelled `Открыть лист` action plus DM-only color and confirmed kick
actions; bulk participant selection is not part of the rail. A DM reorders
players by holding and dragging any non-interactive area of the participant
tile; buttons and combat controls remain regular click targets. The shared
`useSortable` interaction suppresses the menu click after an actual drag and
persists the complete order in `session_participant.sort_order`; a failed save
restores the previous order. The color is stored on the participant's session
membership and always renders as a 2px frame around the whole player tile,
including its combat state; hover never replaces or gates the marker. The avatar
itself has no color frame. The same 2px tile frame is the player marker on common
combat rows; their former left `BaseTile` strip is not rendered. Color palettes, encounter cloning and the
chapter status/arc choices use `RowActionSubmenu`: a separate adjacent popover
on desktop and an inline section with a left accent boundary on mobile. Every participant trigger fills the rail width. A dashed `+` action
beside the `ИГРОКИ` heading opens existing-owned-character attachment, character
creation and invite code/link copy actions. Attaching an existing character uses
the same transfer confirmation as the invitation flow, refreshes the rail and
keeps the session workspace open; the rail has no separate invitation tile. A separate header control
switches the `264px` rail between its normal width and a compact avatar-only mode.
Expanded participant tiles keep their `72px` height with `4px` padding around
a `64px` image, while compact mode keeps its `36px` geometry. Independent
character icons render square without the portrait rounding or radial mask;
setting-provided portraits retain both. The
choice is stored per session in `localStorage`. Combat is the third visual
state: it temporarily expands the same rail for initiative and selection
controls, then returns to the user's saved normal or compact state when combat
closes. Width, tile height and text visibility use one coordinated transition;
compact avatars retain the participant menu, tooltip and hold-to-reorder input.
The left rail's hit area and height end with its rendered heading, players and
error message (up to the
viewport max-height), so the uncovered canvas below a short player list remains
available for pan and node dragging.

The session page is a campaign workspace rather than a stack of independent
content pages. Its semantic header groups `Сюжет`, `Бой`, `Локации`, `NPC`,
`Задания`, `Материалы`, `Дневник`, `Хроника` and `Настройки` in the center.
Presentation, timer, dice and treasure controls form a vertical tool rail on the right. All these buttons use unframed
24px icons with small labels underneath and no backing surface. `Музыка` keeps
its compact horizontal player at the far right. The session name stays on the
left with the arc below it in every workspace; the status icon sits beside both
lines. At workspace widths up to 1100px, navigation moves to a second,
horizontally scrollable row. The measured header height controls the participant
rail offset so the two never overlap. The
participant rail remains on the left and the
right tool rail stays visible, including on mobile. In `Сюжет` the chapter canvas fills all available
width below `AppHeader`; the participant and tool rails reserve horizontal safe
areas. CSS safe-area variables keep focus, zoom and newly created nodes in the
uncovered part of the canvas. All secondary tabs (world catalogues, music,
journal and chronicle) share `SessionTabWorkspace`: it owns the canvas background,
starts content 28px after the visible participant rail, and limits content width
to 1440px, left-aligned with that rail. Collapsing the rail updates the same safe
area for every tab. Catalogue columns retain an 8px internal gap. Story and
combat are outside this wrapper and have no width limit. On mobile (up to 760px)
the participant rail disappears and the shared wrapper uses 16px outer padding on the left and reserves the tool rail on the right.
Individual tab components own their internal layout and scrolling, not rail
offsets or outer padding; this also applies to loading and error states.

The primary switch remains active at every story depth. `Музыка` opens the
central session library and also acts as a compact always-visible player when a
track is selected: the track name replaces «Музыка» in the same fixed-width
label. Only overflowing names scroll back and forth; reduced-motion users see an
ellipsis and the full title remains in the tooltip. Its bottom edge shows playback progress, while adjacent
pause/resume and next-track controls do not change the selected workspace.
There is no separate right-rail music tile, fullscreen library modal or local
open/close state. Combat is represented
as a real tab next to Story rather than a tool icon: selecting `Бой` opens the
existing animated workspace, and selecting `Сюжет` runs the same closing
transition back to the preserved chapter/scenario context. Selecting a world
catalogue closes the combat workspace without stopping an active encounter;
its red live marker therefore remains visible on the inactive `Бой` tab. Each
catalogue selection stays in its own query key, so
returning to a catalogue restores the previously selected location, NPC, quest
or material. The four tool controls stay in the right rail across every tab.

Кнопка кубиков в правой колонке открывает `DicePanel` в `BasePopover`, по той
же модели, что экран показа и таймеры. `useSessionDice` живёт в постоянно смонтированном контроллере, поэтому
горячие клавиши бросков работают и при закрытом popover. Выбранный режим броска сохраняется при закрытии поповера.
Кнопка сокровищ открывает [генератор](master-tools.md) с фильтрами, броском монет,
просмотром предметов и копированием результата.
Отдельная master-only кнопка `Таймеры` открывает компактную форму с описанием,
минутами/секундами и быстрыми пресетами. Каждый запущенный таймер появляется
как отдельное плавающее стеклянное окно поверх рабочего пространства. Окно
перетаскивается за заголовок, при взаимодействии поднимается наверх, не выходит
за границы рабочей области под командной шапкой сессии, а его позиция сохраняется для текущей сессии в
`localStorage`. Карточка показывает серверно
синхронизированный отсчёт и прогресс, позволяет поставить таймер на паузу,
продолжить и добавить одну или пять минут. После нуля карточка получает заметное
завершённое состояние и кнопку `Убрать`; добавление времени запускает её снова.
Таймеры сохраняются в PostgreSQL, поэтому переживают перезагрузку страницы и
сон браузера. При создании мастер может включить `Показывать в трансляции`;
флаг относится только к этому таймеру. Такие отсчёты появляются на анонимном
экране с локально синхронизированным временем и прогрессом, остальные остаются
только в рабочем пространстве мастера.
`Дневник` открывает master workspace через `Alt`/`Option` + `7`. Единственный
дневник кампании использует те же `JournalWorkspace` и вертикальную
`JournalTimeline`, что вкладка дневника персонажа. Отступы от панели игроков
и предельную ширину задаёт общий `SessionTabWorkspace`; дневник прокручивается
внутри полезной высоты вкладки.

Только DM этой сессии видит справа в шапке `Игроки могут редактировать дневник`.
Выключение оставляет игрокам чтение, но запрещает изменения на сервере.
Разделы переключаются горизонтальной строкой с `Новый раздел` в начале.
Карточки видимого раздела идут от новых к старым и растут по содержимому.
Кнопки добавления, редактирования раздела и изменения порядка стоят справа
сверху области событий. Холста, масштаба и отдельной панели подробностей нет.

Один карандаш в шапке открывает общий черновик карточки с сохранением/отменой.
Рамка окрашена по типу; иконка находится слева от названия, без водяного знака.
Отдельный тип `Заголовок` разделяет ленту. Существующий тип неизменяем.
На desktop заголовок служит ручкой перетаскивания; на touch-устройствах
прокрутка не перехватывается, порядок меняется кнопками вверх/вниз.
Изменение порядка проверяет исходную последовательность ID и не меняет
авторство, содержимое или сохранённые связи прежнего холста.

`В дневник` в меню блока сценария сохраняет снимок источника, цвета диалогов
и ссылки на существ. Иконки бестиария видны в карточках; подсказки источника
и времени/автора — под иконкой информации рядом с карандашом и корзиной.
Polling приостановлен во время правки и drag.
Черновик сохраняется при ошибке; параллельная устаревшая правка отклоняется.
Подробнее: [Дневники](./journals.md).
Отдельная вкладка `Задания` открывает каталог заданий сессии через
`Alt`/`Option` + `4`, между `NPC` и `Материалы`. Задания дневника остаются
в общей ленте независимо от каталога; данные и связи сценария сохраняются.

`Хроника` открывает отдельный центральный workspace с `SessionEventsPanel` и
доступна через `Alt`/`Option` + `8`. Панель занимает полезную высоту workspace и
прокручивает только собственную хронику по вертикали; длинные имена, описания и
результаты бросков переносятся без горизонтального скролла. Новые записи находятся сверху и
объединяются по последовательной паре «субъект + пользователь», без группировки
по дате или минуте. Внутри соседние действия одного предмета, характеристики
или ячеек заклинаний образуют вложенную группу. Все круги и оба пула
восстановления объединены под заголовком «Ячейки заклинаний»; круг и пул
сохранены в данных каждого действия; в карточке показан круг без подписи типа отдыха. Порядок событий не меняется;
возвращение к предмету после другого события начинает новую группу.
Ширина поверхности хроники ограничена 980px. Новые записи плавно появляются
с коротким смещением сверху; начальная загрузка и обновления старых строк
не запускают эту анимацию. При `prefers-reduced-motion` движение отключено.
Ключи групп привязаны к их старейшей записи, поэтому добавление нового действия
не пересоздаёт соседние строки. При чтении ниже начала ленты позиция сохраняется.
Шапка показывает состояние синхронизации, число видимых записей и открывает
`BasePopover` фильтров. Автор выбирается как все / владелец / игроки через
`MultiToggle`, субъект — из реально присутствующих в загруженной хронике
персонажей, существ и системных событий, тип — независимыми категориями
«Броски», «Персонаж», «Бой» и «Сюжет». Активные фильтры остаются чипами под
шапкой, снимаются по одному или общим сбросом; пустая фильтрованная выдача не
выглядит как пустая сессия и предлагает вернуться ко всей хронике. Фильтрация
применяется локально к загруженным событиям и не меняет серверный журнал.
Левая колонка группы показывает имя персонажа/существа и логин автора (`authorName`),
а у мастера вместо логина — «я», без отдельной метки роли. У NPC строка автора скрыта; перед именем стоит цветная буква из снимка события. Увеличенный аватар 52px выводится
без рамки, подложки и тени: character icon с fallback на портрет, media бестиария,
монограмма либо тематический DM fallback. Вертикальная линия справа от колонки
аватара и имён отделяет её от событий, расположенных правее линии. Аватар, имя
и пользователь закрепляются у верхнего края прокрутки на время своей группы;
в конце линии они уходят вверх вместе с группой. На верхнем
конце каждой линии стрелка указывает вверх, в сторону новых событий. Между
соседними группами проходит горизонтальный разделитель. На mobile аватар
располагается над именами в узкой левой колонке; события остаются справа. Время находится
у каждого действия, полная дата доступна в подсказке.

Предметная группа показывает иконку и название с кнопкой открытия штатного
`ItemViewModal`. Если действие одно, его название находится справа от имени
сущности в той же строке через фиолетовую точку. Название действия выделено более
крупным и контрастным текстом; при нескольких действиях каждое начинается с
фиолетовой точки на отдельной строке ниже, без повторения
имени источника. Остаток предмета/ресурса показан после названия действия как
`(было → стало)`, без отдельного «Осталось n/m». Для ресурсов прежнее значение
вычисляется из сохранённых остатка и signed delta; несколько ресурсов подписаны
своими именами. События без числовых данных не получают выдуманных остатков. Зависимые
применения, эффекты, проверки последнего заряда и броски из справочных описаний
сохраняют ссылку на исходный item. Иконки характеристик берутся из справочника
характеристик, а не из пользовательского payload. `DiceRollResult` показывает
настоящие `SystemDie` с выпавшими значениями, знаками, модификаторами и итогом
после `=`. Отброшенная при преимуществе/помехе кость приглушена.

`data.source` хранит `itemId`, снимок `name` и необязательный `instanceUid`;
`data.ability` хранит идентификаторы характеристики и её справочника с именем.
Иконки предметов загружаются пакетом по ссылкам из событий. Уже записанные
`itemId` и `spellId` также являются предметными ссылками; события без ссылки
остаются самостоятельными. `data.resourceChanges` хранит signed `delta`, цвет,
имя, остаток/максимум и для магии круг/пул восстановления. Изменение показывается
через `SpellSlotSphere`: перед ячейкой стоит «−» в красной рамке расхода или
«+» в зелёной рамке восстановления. Множитель `×N` показан только при N > 1;
За вертикальным разделителем выделена подпись `N круг` без слова «ячейка»;
подписи долгого/короткого отдыха скрыты. Цвет самой ячейки сохраняется. Ручной расход и восстановление
магии пишут `spell_slot_changed`, восстановление после отдыха также попадает
в историю по кругам/пулам. Оплаченное заклинание хранит расход в `spell_used`
ровно один раз; заговор и применение без ячейки не показывают расход.
Изменение настроенного максимума ячеек не считается игровым расходом.

`stores/sessionEvents.js` загружает последние 50 записей, затем получает новые
по cursor только после invalidation из общего SSE-потока страницы сессии и
устраняет дубликаты по серверному id. При восстановлении потока выполняется
catch-up запрос, поэтому coalescing, разрыв соединения или рестарт процесса не
теряют записи. Когда на странице сессии открыт модальный лист,
контекст бросков временно получает uuid этого персонажа; закрытие листа
возвращает общий контекст мастера.

## Уведомления событий

Страница сессии (мастер и игрок) и собственный лист слушают общий SSE-поток.
У мастера вне открытой хроники чужие события и изменения их игровых данных
показываются в общей очереди уведомлений внизу справа, вместе с бросками кубиков.
Собственные действия не вызывают уведомлений, в том числе из другой вкладки
или устройства. Игрок получает предложения предметов своим персонажам
(`item_transfer`, статус `pending`), адресованные сообщения и вызовы, а также
ответ соперника на свой вызов. Посторонние игровые действия и решения по передачам
не вызывают всплывашек. Открытая переписка подавляет уведомления этой пары.
У мастера кнопка «Открыть хронику» переключает раздел; в листе уведомление о
передаче предлагает «Открыть события». Начальная история проходит без всплывашек,
кроме незавершённых предложений текущему игроку. Список передач листа также
показывает входящие предложения независимо от доступности хроники; оба источника
дедуплицируются по пользователю, сессии и eventId.
Открытая хроника показывает новые строки с анимацией без дублирующей карточки.

Сравнение `type/action/data` отличает изменение события от повторного чтения или
обновления аватара. Новое состояние передачи заменяет уже видимую карточку той
же записи. Исходный локальный бросок показывается один раз даже при гонке POST
и SSE: сервер возвращает `clientActionId`, который клиент связывает с показанным
результатом. Уведомления чужих бросков доступны только мастеру.
При смене сессии её уведомления и контекст очищаются, запоздалые ответы игнорируются.
Инкрементальная загрузка дочитывает пачки по 100 записей, сохраняя последние 200.
Курсор продвигается только ответами чтения: ответ на собственное действие
не перескакивает через ещё не загруженное входящее предложение.

## Session timeline

`session_event` stores semantic gameplay actions rather than arbitrary sheet
JSON changes. The current producers are dice rolls, short/long rests, resource
use and manual replenishment, spell-slot spending/recovery, potion/inventory spending and replenishment, spell use,
current chapter, encounter start/finish, player messages and RPS challenges,
and `entry_added` for inventory items,
weapons, potions, spells, feats and abilities. Direct picker/manual additions
and level-up grants use the same event. Regular editing, drag ordering, music
controls and manual configuration do not create timeline noise.

Each event stores `actorName` and `action` independently. `actorName` is a
snapshot, so renaming a character does not rewrite history; `actorCharUuid`
keeps the optional structural link used for permissions and character context.
The server authenticates every timeline read/write as either the session DM or
a participant. Timeline reads and incremental transfer updates return all events
to the DM; players receive transfers addressed to characters they own and
messages/challenges involving their own characters.
Public visibility does not expose other gameplay actions to players. Players can reference only their own participant and the server
derives that character's name. The DM can reference any participant or supply a
standalone creature name when no character UUID exists. Events that describe
the session itself have neither actor field. Character pages select their event
context from the explicit `?session=<uuid>` query, falling back to the
character's attached session. Player session cards open that character context instead
of the DM workspace.

State-changing character actions are queued by the sheet and sent in the next
`PUT /char/{uuid}/data`; backend character data and its events commit in one
transaction. A cantrip still schedules this semantic save, but the character
version advances with each successful version-checked save, including event-only saves. Dice rolls use the direct
event endpoint because they do not mutate character state. Pending debounced
character saves are flushed on page unmount instead of dropping their events.
Encounter initiative, HP and challenge rolls pass an explicit actor override,
so they are not attributed to an unrelated sheet left open by the DM. NPC events keep the name separate from a frozen `data.npcActor` snapshot
(`uid`, `name`, `letter`, `color`), including rolls from the encounter creature
card and current-turn panel. `NpcMarker` renders the letter before the name
with the same font and color as combat. Historical events without a marker
snapshot retain their original text; their original color was not stored.

## Locations and prepared NPCs

`Локации`, `NPC`, `Задания` and `Материалы` are DM-only primary central workspaces, not extra permanent
side panels. Their surfaces sit over the same tokenized dot field as the story
canvas. The selected mode is stored per session in local storage; `view`,
`location`, `npc`, `material` and `quest` query parameters preserve a shareable selection. Combat is
still a temporary overlay. Opening it from either world workspace keeps that
workspace mounted underneath and closing combat returns to the same mode and
selected entity. All four catalogues render the selected record through one
`SessionEntityDetail` header and body shell. `SessionEntityForm` owns one draft
shared by its header, visual and body components. There is no general
`Редактировать` button in the detail header. Borderless pencils without a
background sit next to each editable value. The location kind, NPC race and
role and color, quest status, and material type and note style are edited in the header
alongside the name; they are not repeated as cards below it. Full edit flows
(such as creation, the location tree edit action and changing a material type)
expand those same header values into inputs in place. Text and enum header fields
use the shared `InlineEdit`: row height stays fixed, and confirm/cancel sit inside
the input on the right. Width follows the current text or selected enum label,
with a 120px minimum and room reserved for both buttons, capped by the container.
Creation fields show descriptive placeholders without pre-filling saved data. NPCs without a race show `Раса не выбрана`; their color
uses the shared `ColorPresetPicker` popover in the header.
Clicking a location or NPC header image opens an action menu: add/replace opens
the catalogue directly, while clear saves `imageId: null`. Both entities support
an empty image and then show their type icon. The image catalogue stays open if
saving fails. A location required as a scenario's only visual source cannot be
deleted until the scenario is given another source. Material assets are changed
through their header icon. Locations and NPCs have no separate image card in the body.
The NPC bestiary reference appears below its description as a `HandbookListItem`;
clicking it opens `ItemViewModal`. Nested locations (`Внутри`) also appear directly
below the location description, before universal relations.
Materials keep their full image/video or styled text preview in the body when
viewed; full editing does not duplicate the preview. A material type change
opens the full form so dependent contents or assets can be supplied together.
Single-field saves use current entity data to preserve other fields, and failed
saves keep the draft open for retry. Quest goal, condition, reward, consequences
and notes keep separate cards with semantic icons.

Opening a location, NPC, quest or material from `UniversalRelationList` pushes
the current entity into a per-session navigation stack. The detail header then
shows `Назад к «…»`; returning pops one level without creating a new entry. The
ten newest relation transitions are persisted in local storage. Direct sidebar,
tree and search-result selection starts a fresh chain, and scenario canvas links
remain outside this entity stack.

The four catalogue sidebars share keyboard navigation: `↑` and `↓` select the
previous or next currently visible row and keep it inside the scroll viewport.
Navigation follows the filtered result order; the location tree additionally
skips descendants hidden by collapsed parents. At either edge the selection
stops instead of wrapping. The arrows also navigate search results while the
catalogue search field is focused, and the compact mapping is shown there when
contextual shortcut hints are enabled.

Locations deliberately use a hierarchy instead of another graph canvas. The
left part of the central workspace is a searchable tree, while the selected
location owns the detail area with its image, breadcrumb, description, children,
relations and read-only canvas usage. Expanded tree rows are stored per session in local storage.
The DM drags the whole row: dropping into the upper or lower part places it
before or after a sibling, while dropping into the middle makes it a child of
the target. The server validates session ownership and rejects self/descendant
cycles. Root dropping returns a location to the top level. There are no
location-to-location graph edges or geographic canvas state.

A location stores a semantic kind, shared-catalogue image, description, parent
and sibling order. Scenarios are not universal relation targets. The location
form has no `Внутри локации` field: hierarchy is changed through the location
tree. Editing other fields preserves the parent. Deletion is blocked until
direct children are moved or deleted.

Prepared NPCs live in one searchable session catalogue. A record has a name,
an optional race item, optional role and description, card color and a portrait.
The NPC editor can also link one existing type `6` bestiary creature without
copying its stat block. Removing that handbook item clears the optional link.
The portrait may come from an independent NPC preset catalogue or an uploaded
storage image; it is not mixed with chapter/location backgrounds. The race picker
combines base races from handbook type `8` and subraces from the separate type
`16`, labelling a variant together with its linked `data.race`; the stored nullable FK is cleared if that
item is removed. The name field has an explicit dice action backed by the same
race-aware generator as the D&D character wizard. Standard race profiles combine
at least 80 given-name/family-name variants each, while an unknown custom race
uses a broad fantasy fallback. Locations, NPCs, materials and quests use one
symmetric relation model. Every entity can link to any entity of those four
types, including another entity of its own type, with an optional private note.
`Добавить связь` opens one picker: the DM can search across the complete
catalogue or filter a type. The shared relation list groups links by type in both
modes, with a dashed plus immediately beside the `Связи` heading and a trash button
in each link card's corner. These actions save immediately in view mode and
change the draft in full edit mode. The source and existing links are excluded
from the picker. Link notes have their own pencils and are expanded during full
editing. The trash action is separate from card navigation. Editors use the
shared `ColorPresetPicker`, `SessionImagePicker` and form controls.
Each detail view has a separate read-only `На холстах сценариев` section. It is
derived from actual reference/material blocks, deduplicates scenarios, shows a
block count and opens the selected scenario. It cannot be edited from an entity
editor. Materials remain available from every scenario; placing one on a canvas
updates this derived usage instead of creating a relation.
`SessionImagePicker` keeps only the current image and `Сменить` in the parent
editor. Its modal renders every preset in one grouped scroll, with category
shortcuts that jump to section dividers; upload, when supported, is an action in
that modal. Picker tiles preserve each source image's aspect ratio: their width
follows the responsive grid while the complete image determines the tile height,
without centre-cropping. The NPC catalogue includes balanced female and male
portraits for villagers, city trades, guards, travellers and cultists, including
weathered everyday characters rather than only idealized adventurers.
World data is loaded lazily as one aggregate through `useSessionWorld`, then a
successful mutation replaces that aggregate so every reverse association stays
consistent.

The quest workspace is a searchable journal built on the same library shell.
A quest stores a name, separate goal, condition, reward, consequences and
master notes, status (`Запланировано`, `В процессе`, `Выполнено`, `Провалено`)
and universal relations. The detail view emphasizes the goal and shows the
remaining filled sections as compact cards; search covers every field. Its
selected id is deep-linked through `quest` just like locations and NPCs.

## Chapters, scenarios and blocks

### Materials and the player screen

The previous fight-only TV page is now the session's anonymous player display
at `/screen/:code`. Its live state is one of `idle`, `material` or `combat` and
is kept separately from encounter JSON. Starting and finishing
combat switches this state automatically. A blackout hides current content
without discarding it, so the header control can reveal it again; `cut` and
`fade` are the deliberately small transition set. Rain, fog, embers, snow and
storm are visual layers rendered only by the player display. `Очистить` returns
the display to a visible idle state with the same dotted canvas background;
`Затемнить` remains the explicit action that covers the player screen in black.
The screen title and session name are rendered only for that idle state. During
material playback the asset occupies the whole viewport without a card frame or
metadata column; images, maps and video use contain scaling. The connection chip
is hidden while synchronization is healthy and appears only after an update
failure. The screen opens an SSE invalidation stream for immediate updates,
performs a control sync every 45 seconds and temporarily falls back to jittered
polling with exponential backoff while SSE is disconnected. Each event reloads
the latest database snapshot, so coalesced or missed events cannot lose state.

`Материалы` is a central DM library over the same dotted workspace background.
It uses the same `SessionLibraryWorkspace` shell, safe areas, sidebar surface
and detail geometry as locations and NPCs. A material has one of five explicit
types: image, video, plain text, styled note or map. Notes can use parchment,
letter, dossier or arcane presentation. A map currently renders as an image but
already owns its type and reserved `map_data`, so later layers and markers do
not require redefining ordinary images. Each material is stored once and may
have several universal links with an optional note. Scenario links define where
it is contextual; with no scenario links it remains available throughout the
session. Chapter attachment is not part of the model. The editor uses the same
editable universal relation list and searchable picker as locations, NPCs and
quests. The session-header display control
shows the current `Бой` / `Картинка` / `Письмо` / `Видео` / `Ничего` mode,
opens the standalone display and provides one icon toggle for blackout/reveal.
An active material has a contextual `Убрать` action; there are no generic clear
or stop actions. The player-only effect selector uses a compact illustrated icon
grid rather than plain text chips.
Its `Транслировать музыку` checkbox moves audible playback from the DM page to
the standalone display without changing the controller, queue or timeline. The
DM audio engine remains muted while it advances the clock and album queue; this
allows turning the checkbox off to restore local sound at the current position.
The display owns a two-element audio engine for volume, pause/seek, looping and
crossfade, and shows `Включить звук` only when browser autoplay policy requires
a user gesture.
The combat toolbar does not duplicate the standalone-screen launch action.

Plain text and styled-note bodies use the shared `--font-prose` reading face in
both the DM preview and standalone player presentation. Compact material-list
metadata, controls and counters remain in the UI face. Full NPC, location and
quest detail paragraphs follow the same split; their list-card snippets remain
UI text.

A scenario selects one session location through the universal relation search picker
with its type fixed to `location`; the editor shows the location path and allows
clearing the selection. This
link is separate from universal entity relations and from location reference
blocks on the scenario canvas. Scenarios themselves are not a player-display mode: the master broadcasts a
specific material from the header library or a scenario block. The third-level `image` block
references an existing contextual image or map material rather than duplicating its asset;
its leading action broadcasts that material immediately. All uploaded material
assets continue to use the ownership-aware `storage_image` registry and S3 URLs;
video uploads are limited to 100 MB, while text and note bodies remain database
content. Large media is spooled to a temporary file and uploaded with a global
three-operation concurrency limit, so concurrent videos do not accumulate in the
Go heap.

Every session has at least one ordered arc. Arc order is the canonical campaign
order; the UI renders it as a Roman number and rewrites `1..N` atomically after
reordering. Arcs do not have a status. Each arc owns an independent chapter
canvas and its transitions.

Chapters are graph nodes. A chapter has a free display number (`1`, `3A`,
`Пролог`), name, optional description, status, image and canvas coordinates.
Numbers are unique inside an arc, not across the campaign. The supported status
set is `draft`, `planned`, `ready`, `available`, `in_progress`, `paused`,
`completed`, `failed`, `skipped`, `cancelled`. The session-level chapter pointer
is shown to users as `Сейчас здесь`: assigning it to a preparatory chapter
promotes that chapter to `in_progress`, and only one chapter in the session can
carry the pointer.

`ChapterGraphToolbar` is the semantic session header with its own background and
bottom divider, not a `BaseTile`. `SessionToolbarIdentity` owns the editable name,
status menu and arc switcher; `SessionToolbarMusic` owns the compact player and
overflow measurement. Current-chapter focus, zoom and contextual creation stay
on the canvas. There is no second session title bar or nested switcher.
`SessionGraphCanvas` keeps one physical `NarrativeGraphCanvas` mounted for all
narrative levels. The session name is the largest text in the command bar. The
unframed arc trigger below it reads `АРКА <Roman number> <name>` and opens the
complete arc list with the shared action-menu motion.
A DM drags any non-interactive
part of a row to reorder arcs; arrow controls are not used. Each row has a
pencil but no dedicated drag-handle dots; it opens `ArcEditorModal`, whose edit mode also owns the confirmed
delete action. `SessionGraphCanvas` uses the
application-wide canvas background and dot-color tokens, supports pan/zoom and
stores a viewport per graph in local storage; its 24px base grid repositions and
scales with that viewport. Every graph constrains the camera center to the
bounding box of its cards plus `320px` horizontal and `240px` vertical world
space, using the safe frame between the side rails; saved legacy viewports,
zooming and rail resizes are clamped by the same rule. Empty graphs remain
unconstrained until their first card exists. Nodes can be dragged; during an
active drag their transform transition is disabled so the node and every
connected edge update in the same frame. Spotlight transitions remain animated
outside dragging. `Ctrl`/`Cmd` click toggles node selection within the active
graph; dragging with the modifier held, from either a node or empty space,
draws a frame and adds every intersecting node to the selection instead of
moving cards or the camera. Dragging any selected node without the modifier
moves the whole selection without changing relative offsets. Plain node clicks
retain their action menus; clicking empty canvas space without the modifier or
pressing `Esc` clears selection, and changing graph levels also resets it. Two
or more selected nodes show a bottom-center action bar inside the safe frame
with the selected count, atomic bulk deletion and clear-selection. On the
chapter canvas the bar also provides the canonical color-coded status choices
and applies the chosen status atomically to every selected chapter. The scenario
canvas exposes the equivalent action with scenario-specific labels; blocks have
no status field. Both catalogues begin with the neutral `none` / `Без статуса`
value, which is the default for newly created chapters and scenarios.
Bulk chapter deletion fails as a whole when any selected chapter still contains
scenarios; bulk scenario deletion also removes its blocks.
Desktop session pages keep only the frameless `? · Горячие клавиши` affordance
at the bottom-left. Pressing `?` or clicking it toggles contextual shortcut
hints without reserving space or moving the participant rail: section hints sit
under their header tabs, the panel hint sits under the dice button, dice-roll
hints inside the corresponding dice, and canvas-only hints remain over the
bottom-left of the canvas safe area, beside the participant rail. If the dice panel is closed, its header button
temporarily shows the compact `1…7 · d4…d100` mapping instead. `Esc` hides the hints while preserving its
existing canvas action. The contextual help is hidden on touch and mobile
layouts.

Session-wide shortcuts use physical key codes and therefore do not depend on
the current keyboard language. `Alt`/`Option` + `1…8` opens Story, Locations,
NPCs, Quests, Materials, Music, Journal and Chronicle; `Shift` + `D` toggles the dice
popover without conflicting with browser address-bar shortcuts.
`Alt`/`Option` + `Shift` + `1…7` rolls d4, d6, d8,
d10, d12, d20 or d100 using the currently selected normal/advantage/disadvantage
mode. Dice rolling works while the dice panel is closed because its controller
remains mounted. Section switching is DM-only, matching the visible navigation;
panel and dice shortcuts are available to every session participant. Global
shortcuts ignore key repeats, text inputs, content-editable fields, open dialogs
and popovers. The only text-input exception is `↑` / `↓` in a session catalogue
search field, where the keys navigate the currently filtered rows.

Master timer cards also provide `−1 мин` and `−5 мин` controls. Subtraction is
persisted on the server and clamps the remaining countdown at zero.

Combat uses the same contextual shortcut system. `Shift+B` opens or closes the
combat workspace for any participant and preserves the chapter/scenario context
of the visible story canvas. Its session-header tab represents workspace
visibility and encounter activity independently: the standard active-tab
underline means the combat workspace is open, while a red live dot and tint mean
the encounter itself is running. Those two signals produce four visibly
distinct combinations, including a running encounter whose workspace is
closed; the accessible label names both states. While that workspace is open,
DM-only commands are
`Shift+Enter` to start or end the encounter, `←` / `→` to move to the previous
or next turn, `Shift+P` to toggle all players, `Shift+N` to toggle the NPC
reserve, `Shift+A` to toggle every combatant on the battle scene, and `Shift+R`
to reroll initiative for the current selection. `Backspace` removes only the
selected NPCs, matching the existing toolbar action and never removing selected
players. The start/end shortcut calls the
same transition controller as the toolbar button and remains unavailable until
at least one participant is selected. When contextual help is enabled, each
combination appears beside its corresponding combat control. `Shift+Enter`
defers to the browser's native activation when focus is already on a button or
link, preventing one keypress from invoking two actions.

When contextual canvas hints are visible, they reflect the active behavior:
`Ctrl`/`Cmd` + click toggles a node, modifier-drag adds nodes through a frame,
`Ctrl`/`Cmd` + `A` selects every node in the active graph, `Delete`/`Backspace`
opens the existing confirmed bulk deletion, `Esc` cancels the active link or
selection, `+`/`-` changes canvas zoom, and double click opens the nested
canvas. The only session-local setting in the header is automatic bestiary HP
rolling; it is stored per session in local storage.
Drilling into a narrative level waits for the 420ms spotlight movement to reach
its ancestor position, then swaps the graph identity, payload and preloaded
viewport in one render. DOM keys include the graph identity so equal numeric IDs
from different entity tables cannot reuse a node. Returning prepares the parent
viewport before its payload appears and keeps the returning node in the ancestor
position for one painted frame before animating it to its saved coordinates.
Combat appears together with the participant-rail transition and hides the
narrative canvas for the duration of the workspace. The selected chapter,
scenario and narrative level remain mounted as hidden state, so closing combat
restores the same canvas without reloading or resetting it. Reduced-motion users
skip the transition.
A regular node click opens its action popover: its first action explicitly opens the chapter scenarios, then it can mark
it as `Сейчас здесь`, change status, edit, start a transition, move to another
arc or delete.
Status choices use the same configured semantic colors as the status badge on
the chapter node. While scenarios or blocks are open, clicking the pinned
chapter preview opens a reduced chapter menu with return-to-chapters, status
change and edit actions. Outside combat, a single contextual back button below
the pinned chain reads `К главам` on the scenario canvas and `К сценариям` on
the block canvas, and always returns exactly one level. Combat hides the story
canvas together with its pinned context cards and navigation controls.
Double-clicking a chapter opens its scenario canvas directly.
Moving a node to another arc removes its old transitions after confirmation
because a transition cannot cross arc boundaries.

The chapter illustration covers the complete node. Number, title and optional
scene count sit on a blurred translucent overlay above the image; lifecycle and
`Сейчас здесь` markers remain at the top. The neutral `none` lifecycle marker
is omitted. `sceneCount` is derived by the graph
read API, not stored on `session_chapter`, and is updated optimistically when
contextual scene CRUD changes the count.

Chapter transitions are one-way or bidirectional edges inside one arc. They may
have a short optional label; clicking either the curve or label opens label,
direction and delete actions. Reverse is shown only for a one-way edge. The
graph API validates that both ends and the edge belong to the same arc and
session.

The built-in story image catalogue is shared by chapters, scenarios and locations
and served by `GET /api/session-images?scope=story`. The picker first selects one of
four categories — settlements, wilderness, adventure or story — and then an
image inside it. Story adds battle, investigation, negotiation, chase, puzzle
and discovery covers to the original location catalogue. A chapter may instead
use an image uploaded through the normal storage endpoint and adjust its focal
point. Chapters and locations store an image; a scenario may leave its own image
empty and inherit the current image of its linked location. Both catalogue and
custom files resolve through `storage_image` in S3.

Scenarios belong to chapters and form a second directed graph. A chapter action
or double click keeps the same canvas engine mounted and swaps its chapter nodes
and edges for scenario nodes and edges. The selected chapter gets a temporary
presentation transform to the safe top-left corner; normal coordinates stay
unchanged and the other nodes and edges fade out. Once the swap completes it is
rendered as a fixed ancestor card above the same canvas. The scenario graph has
its own persisted viewport, coordinates and direction-aware edges. Its illustrated
nodes can be dragged and linked through the same right-side port pattern. The
DM creates or edits the scenario name, lifecycle status, optional location and
optional shared-catalogue image, or deletes the scenario. At least the location
or the image is required; an explicit image overrides the location image. Its optional top status chip uses the same
semantic color as the menu and bulk action and is omitted for `none`; the lower
title surface uses the same translucent treatment as a chapter and has no
redundant `Сценарий` label, generated scenario number or double-click hint. A single click anywhere on a scenario card opens
its launch, open-elements, status, edit and delete actions without a separate
ellipsis trigger; double click still opens the scenario block canvas. The scene
image continues beneath the translucent lower copy surface just as it does on a
chapter card, rather than ending above an opaque footer.
Deleting a linked location clears the link; a scenario that inherited its image
keeps the location's current image as its own so the card never loses its visual
source.

Double-clicking a scenario switches the same physical canvas to the third graph.
The scenario node first moves to the top immediately to the right of its chapter
and its peers and edges fade out; then block nodes replace the graph payload.
Description, dialogue, combat, reward, image, material, location, NPC and quest blocks have independent coordinates, persisted widths,
content-sized heights and direction-aware links. Their accent color is derived from
the type instead of being user-selected or stored. Block cards use the same
dark `var(--surface)` backing and inset border as `BaseTile`, with only a quiet
type-colored hover tint and no leading color strip. Every card starts with a
separated heading group: a small type-colored block kind above a larger display
title, so the title remains the primary landmark over variable content. Every
block type also has a stable semantic icon to the left of this pair; material
blocks use the icon of their concrete material kind. Dialogue blocks store
speaker/reply rows: speaker inputs autocomplete from the unique names already
used in that dialogue, and every speaker receives one consistent distinct
color from the shared palette. Clicking the color circle beside a speaker opens
that palette; choosing a color updates every row with the same normalized
speaker key. On the canvas each row places the right-aligned speaker name,
a vertical speaker-colored divider and the unframed reply in three columns.
Every block card keeps a visible border mixed from its semantic type color;
hover strengthens the same border instead of introducing another accent.
Quest and material full previews start directly with useful
content and do not repeat another icon, entity name or material-kind header.
Clicking any non-interactive
part of a block opens its action menu; there is no separate ellipsis trigger.
The menu provides edit, copy and delete, while a double click opens
`SceneBlockEditorModal`. A combat block contains bestiary references and/or
simplified creature records with quantities. Its leading `В бой` action adds
the whole list to the encounter NPC reserve and opens the combat workspace with
that block's chapter and scenario as its visible context. Bestiary creatures
show their current handbook image or SVG in the card and editor; simplified
creatures use a stable placeholder. A reward block stores quantity-bearing
references to things, weapons and equipment and renders their current handbook
icons and names. An image block references only an image/map material. The
separate material block opens the shared searchable picker over every material
kind available in the current chapter/scenario, renders a type-aware preview
and exposes the same direct broadcast action. Reference blocks use
`SceneEntityBlockPreview` instead of a generic image/name row. Locations show
their kind, hierarchy, description and nesting; NPCs show portrait, race, role,
description and meeting places. A linked NPC also shows an `Открыть в бестиарии`
button which navigates directly to the current handbook creature; quests show status and every filled goal,
condition, reward, consequence and note; materials show their type, caption and
actual image or written content. Every reference card also resolves and renders
the current universal links, so edits to a catalogue object appear on the
scenario canvas without copying its data into the block.
Location, NPC, quest and material create actions are visually separated into an
`Объекты сессии` group. Each action first opens the universal picker locked to
that entity type; choosing a row creates the block immediately. The type header
also has a transparent dashed create action, which opens the canonical entity
editor and places the newly created object on the canvas after save. Reference
blocks have no independent title: the heading and full preview always resolve
the current catalogue name. Their editor only changes the reference and an
optional scenario-local note, which is rendered below the live preview. The
first three types store a validated entity reference and render live catalogue
data rather than copying it into the block.
Block edges are re-measured after content or width changes, and dragging the
right edge persists a width in the `220..640px` range. Clicking the pinned
scenario opens a reduced menu with return-to-scenarios, status and edit actions;
double click remains the direct return shortcut. Double-clicking the pinned chapter at either
nested level returns to chapters. Thus the visible ancestor chain and its single
contextual back button provide level navigation without duplicating a breadcrumb
bar or physical canvas.

`NarrativeGraphCanvas` owns pan, zoom, drag, link-port, edge and spotlight mechanics
for all three levels. `useSceneGraph` and `useSceneBlockGraph` own their server
state and optimistic position/width previews. `useSessionGraphNavigation` owns
the current level and selected scenario id, while `useSessionWorkspace` keeps a
single explicit `idle/opening/open/closing` phase instead of parallel boolean
flags. Drag previews are emitted at most once per animation frame, layout reads
for the safe frame occur only for the spotlight node, and viewport persistence
is debounced. Each graph key persists only its viewport in local storage; node
positions and edges are server state.
When a node drag crosses the movement threshold, the canvas emits one
`drag-start` signal and closes any chapter, scenario, block or edge action
popover before position previews begin.
Completing a link gesture creates an unlabelled one-way edge immediately at
every level; the edge action menu remains the explicit place to add or edit a
label later. During creation the temporary arrow ends exactly at the pointer.
Its source and every completed edge use the centered port on the nearest facing
side of each card, including the top and bottom sides. The same menu at all
three levels can reverse a one-way edge or toggle it to/from bidirectional;
reverse is hidden while both arrowheads are active. Dragging the enlarged hit
area along the first or last part of a hovered curve previews the existing edge
from the pointer and persists the new source or target when dropped on another
card. This keeps converging edges individually reachable before their shared
port. While creating or rewiring an edge, hovering a valid node snaps the
temporary path to the complete future port-to-port geometry and highlights the
prospective target.
`SceneEditorModal` is used for scenario create/edit, `ConfirmDialog` for
destructive actions, and `SceneBlockEditorModal` for block content. Scene and
block CRUD remains in `session_scenes.go`; graph reads, positions and links are
handled by `session_scene_graph.go`.

Combat still uses the same canvas layer from the command bar. Entering it from
an open block canvas hides the narrative canvas and lets the standalone combat
header use the full center width. The command-bar combat action reads the same
currently displayed canvas context, while a chapter-only
canvas falls back to the current chapter. Chapter and scenario ids are saved with
the active narrative level in workspace state and restored after reload. Closing
combat returns to that saved scenario or block canvas instead of resetting the
user to chapters. Chapter and scenario editing stays on the narrative canvas;
the encounter must be closed before using those controls. The player rail adds
combat-only “select all” and “move selected to combat” actions above its cards;
both operate only on players and preserve any NPC selection. With or without a
scenario context, the combat header uses the full center width;
combatants remain independent tiles below it rather than being wrapped in one
central card. The combat workspace uses the
width between the participant safe area and the right tool rail. The header uses one enlarged,
labelled primary action, “Начать бой” or “Закончить бой”, while turn navigation
remains compact and icon-only. The header has one stable composition at every
width: its scenario image keeps its native aspect ratio, scales to the width of
the complete left column and falls back to the chapter image when no scenario is
selected. The chapter and scenario names are overlaid on that image. The right
side keeps combat flow above and grouped actions below, with all controls aligned
to the left. It never hides the primary-action text or group labels. When a
scenario is selected, `Бои сценария` lazily loads its combat blocks in a popover;
choosing one imports the complete configured creature counts through the same
encounter importer without leaving the combat workspace. Secondary actions are
grouped as `Выбранные` (challenges and damage) and `Состав сцены` (scenario import, reserve, death, NPC deletion and graveyard). Initiative rerolls sit beside start/finish and turn navigation.
The combat header has no separate close control; starting and ending combat stays
with the labelled primary action. During active combat the initiative column and
the current-turn reference panel each scroll inside the same bounded workspace
height, so scrolling one column never shifts the other.
`Выбранные` contains challenges and shared damage; roster management stays in `Состав сцены`. Shared damage consumes temporary HP first, updates NPC
encounter state and persists each player character through the character API.
Nested action components use the same icon-button geometry and interaction
states as direct toolbar buttons.

## Encounter

Encounter state is split into composables under `features/sessions/composables`:
load/save, players, NPC item cache, HP, initiative, flow, states and dice.
`useEncounter.js` composes them; row components remain presentation-only.

The encounter workspace has no shared backing surface. Its header and every NPC
row are separate `BaseTile` surfaces. During active combat, the workspace uses
two columns. The left column, capped at 800px, contains the initiative queue and
NPC reserve. The sticky right column follows the current turn: bestiary NPCs
show live combat values plus their reference abilities and actions; simplified
NPCs show the encounter values and description; players show a compact combat
profile with a link to the full character sheet. Selection does not change this
preview. In the chapter canvas the header is fixed
beside the focused chapter while only the rows area scrolls. Row strips use the
explicitly selected participant color for players or `iconColor` for NPCs; rows
without an assigned color have no strip in either combat or the NPC reserve.
NPC artwork uses its native 64×64 geometry and is centered vertically while
player portraits retain their compact framed crop. Session dice pass the default accent color
explicitly to every `SystemDie`. Master rolls made from the session dice panel
enable critical presentation for d20 only: a kept natural 20 shows the shared
critical-success visual, while a kept natural 1 shows the shared critical-failure
visual, including advantage and disadvantage rolls.

Before and during combat, the DM header has a group-challenge action. It opens a
compact setup popover with one of the six D&D abilities and a saving-throw
toggle, then rolls a d20 for selected creatures on the scene or in reserve, excluding the graveyard. The action is disabled until at least one eligible creature is selected. A
normal check uses that creature's ability modifier. A saving throw also uses a
player's save proficiency and extra save bonuses, or the explicit bestiary save
bonus for an NPC; an NPC without one falls back to its ability modifier. Each
result is a fixed-size column after the creature's complete identity/HP block;
scene and reserve rows show results beside their identity/HP block; in narrow rows the result wraps below without overflowing.
It reuses `SystemDie` and the shared roll-settle animation to show the d20 face,
numeric modifier and total without a textual formula. The result block has no
backing surface or enclosing frame; only its left and right borders separate it
from the combatant details. The full check/save event
title wraps inside the embedded result. Its up/down controls keep the existing
d20 visible and roll one extra d20 beside it, then keep the higher/lower natural
value respectively. Only the new die animates; the unused die is crossed out
after the animation settles. Advantage/disadvantage rolls in the global dice
popup follow the same delayed crossed-out state. The full creature name, event
and advantage mode are still written to the session timeline. Challenge rolls
do not duplicate themselves in the global bottom-right popup stack. The same
header action is highlighted while results exist and clears them on the next
click.

Players have no separate encounter reserve section. Opening combat smoothly
widens the existing left participant rail from 264px by the checkbox strip plus the card gap (36px + 9px, total 309px); every player tile gains the
encounter checkbox with additional horizontal spacing; the current turn is
highlighted there. The tile shows only the name and HP, with 14px right padding;
race/class and armor class are absent from the tile; a prepared initiative is shown as a chip beside the name while the player remains in reserve. At the top of
the DM menu, D&D participants show equipped AC and passive Perception/Investigation.
The three indicators form one row: number followed by icon, with vertical
dividers. Hover or keyboard focus opens the shared `ItemTooltip` with the
indicator name, meaning and passive calculation. Before combat starts, the combat-tab menu exposes an initiative submenu with
a numeric input and a roll action. These controls remain mounted inside a fixed-height
tile and slide in from behind its left edge together with the widening rail;
closing combat sends them back left instead of mounting or unmounting them.
Players that enter combat also appear in the common
initiative-ordered combat scene alongside NPCs while remaining visible in the
left rail. Common scene rows keep initiative on the left. AC follows the portrait in a chip: a prominent number followed by a blue shield. Tiles have a 74px minimum height around 62–64px portraits and no trailing ellipsis; clicking the tile or pressing Enter/Space while focused opens its menu. Selection squares are 20px in rows, the player rail and chronicle target selection. The left-rail tile and portrait keep
the same height and circular geometry in and out of combat; the larger combat-scene
portrait is circular too. Player photos use a soft alpha fade around their edges. An
assigned session color appears as the 2px frame of both the left-rail player tile
and the common combat-scene row; it is not repeated on the portrait or as a left
strip. Player rows do not repeat a `PC` type chip. NPC artwork keeps its centered 64×64
geometry instead of falling back to a name initial. Every combat-scene tile has a numbered marker on its
left.
`ViewSession.vue` owns the single `useEncounter` instance shared by the rail and
`EncounterTab`, so selection and initiative always address the same encounter
record.

The DM-only Settings tab persists participant visibility and automatic NPC HP
rolling in the session's structured `settings` JSONB. `combat.autoRollNpcHp`
controls independent HP rolls when adding handbook creatures and synchronizes
across browsers through the session live stream. It starts disabled; no browser
preference is used.

Each NPC also receives the nearest free Latin marker from `A` through `Z`.
The marker sits immediately to the left of the NPC name above the HP bar and is
persisted in `markerLetter`.
Clicking it opens one popover with the full letter list and the marker color
palette; choosing an occupied letter swaps the two NPC markers, preserving
uniqueness. Creature artwork and the letter marker render directly on the row
without separate backing surfaces; the compact letter remains the popover
trigger.

Clicking a chapter or its transition opens an anchored shared action surface:
`BasePopover` provides positioning while every command, including status and
arc submenus, uses `RowActionItem` and `RowActionSubmenu`. There is no separate
feature-specific chapter-menu component or locally styled action button. The
anchored surfaces select the library-owned `action-menu` transition preset, so
they share enter/leave motion with other row-action menus without depending on
another component's CSS.

Clicking a non-interactive area of a combat or reserve row opens its action
menu; initiative, HP, selection, marker and other dedicated controls keep their
own click behavior. The shared menu can edit states for both players and NPCs,
send a combatant to reserve, reroll formula-based NPC HP while it remains in
reserve, and delete NPCs. Bestiary NPCs also expose `Открыть карточку`, which
opens the standard handbook `ItemViewModal`; simplified creatures omit that
action because they have no handbook record. There is no separate HP-reroll button on a row, and
the action is hidden once that NPC is on the combat scene. NPC
color is not duplicated in the row action menu and remains part of the
letter-marker popover. The combat-scene block is mounted only while combat is
active; its select-all control sits beside the section title and no duplicate
live-status chip is shown. The NPC-reserve select-all control follows the same
left-aligned title placement. State editing uses the character setting's state
value path and suggestion dictionary (the `states` part of the combined D&D
status overview), so the same condition list is available for players and NPCs.
When combat starts, selected NPC reserve rows fade out with a short stagger and
the combat-scene block then expands smoothly into the layout. Ending combat
collapses the scene and softly reveals the returned NPC reserve. Player tiles do
not move between rails. Controls stay locked for the short transition, while
reduced-motion users get the direct state change.

When the combat rail changes the canvas safe-left inset, `NarrativeGraphCanvas`
re-measures that inherited layout value after the parent DOM update. The
spotlight chapter therefore animates to the new combat boundary instead of the
normal-width player-rail position.

The graveyard is not a separate workspace section. Two icon-only actions live
directly in the combat header: the skull moves the current selection to the
graveyard, while the bone opens a `BasePopover` with dead combatants. Both keep
their text descriptions in browser tooltips and accessible labels.
Selecting a combatant reveals view, restore and (for NPCs) delete actions. The
popover can also delete all dead NPCs after a `ConfirmDialog` confirmation.

`useSessionWorkspace.js` stores the open workspace per session in local
storage. Reloading the session restores combat against the current chapter or
the scenarios workspace against its previously opened chapter. Explicitly
closing a top-level workspace clears this preference before the closing
animation. Closing combat opened from a nested canvas immediately persists that
return context, so even a reload during the exit animation restores the scenario
or block canvas instead of combat.

Encounter hydration and saving are fail-safe: a failed initial GET never turns
into an empty PUT, writes are snapshotted and serialized after the debounce, a
failed latest write is retried, and a pending snapshot is flushed on unmount.
`ViewSession` hydrates its participant list before loading and reconciling the
encounter, so persisted player positions and initiative survive reload just as
NPC combat state does.
The same flush starts when the tab becomes hidden or receives `pagehide`, which
keeps the debounce window from dropping the latest change during navigation.
The participant list is periodically refreshed while the page is visible;
joining players are added to the encounter reserve and players removed from the
session are removed from encounter state. Polling pauses in hidden tabs and an
in-flight request cannot restart it after unmount.
Hydration also normalizes missing or obsolete combatant positions to `reserve`,
canonicalizes player character identifiers from the current participant list
and removes duplicate legacy player entries. This prevents combatants from
remaining outside every current group and persists the repaired state through
the normal encounter save queue.

Canonical combatants:

- player row references the session participant/character;
- NPC row stores `itemId` for the bestiary item and optional `override` for
  encounter-local name/AC/max HP/other edits;
- transient current HP, temp HP, initiative, state and the NPC `markerLetter`
  live in the combatant encounter record.

The optional encounter-level `challenge` object stores `{ability,
savingThrow,results}`. `results` is keyed by combatant UID and each value is
`{roll,bonus,total,rolls?,dropped?,revision?}`. The optional roll pair and
dropped index preserve an extra advantage/disadvantage die; `revision` restarts
its embedded animation when the kept value does not change. Removing
`challenge` clears the shared result display.

The session display control links to the standalone public route `/screen/:code`
for a television or projector. Each session has a permanent unique code in
`ABC-123` format: six ASCII letters/digits with a hyphen after the third symbol.
Codes are displayed uppercase and resolve without case sensitivity. The DM's
display menu shows the code, copies `/screen/ABC-123` and opens that short link.
Existing sessions receive codes during migration; display routes use only these
codes. Session UUIDs continue to identify authenticated management routes and
invite codes continue to identify membership invitations.
It has no application navigation or authenticated
controls. Its SSE stream refreshes the presentation and, in combat mode, the
public encounter projection immediately; fallback polling and a control sync
cover reconnects, server restarts and missed in-memory signals. Returning to a
visible browser tab also requests a fresh snapshot. In combat the active player
or NPC occupies a larger `4:3` card on the left with full artwork and a blurred
lower info layer; neither it nor the queue cards stretch to the screen height.
The display is fixed to the viewport in every mode, with no page or nested
scrolling. Combat uses a 3vmin safe margin and divides its usable height (after
the gap) into 40% for the queue and 60% for the active card and graveyard.
The active card preserves 4:3 and fits the lower region. On small or short
windows the entire combat composition scales down to keep both regions inside
the viewport, including at the master's 125% scale setting. Text and note
materials shrink their type to fit the complete content and refit after resize;
very long texts therefore become smaller and should be split for TV readability.
Above it, the compact cyclic queue spans the full screen width and begins after
the active turn. Queue tiles are tightly packed squares sized to fit a smaller
full-fit creature icon and the longest worded health state below it. A compact,
ellipsized name sits between the portrait and health, while initiative remains
hidden. The queue prefers the character's small `iconImageUrl` and renders it
without an inner frame or backing; the active card prefers the sheet portrait
and falls back to that icon only when no portrait exists. Active conditions sit over the portrait edge as their colored dictionary
icons; an iconless custom condition uses a colored dot, and additional conditions
collapse into a count. The visible slot count follows the available screen width,
so a long queue reaches the right edge before overflowing into its final stack.
Below the cards, a quiet ticked scale with a right-pointing arrow labels the
direction from the next turn toward later turns.
The current round and queue count sit together below that direction scale,
aligned to its right edge. Overflow layers fan diagonally downward and right inside a reserved edge corridor;
the fan is bounded to four small offsets to the right and down, with later
entries sharing the final layer and a count indicating the remaining queue.
An NPC letter sits just inside the icon's upper-right
corner in its assigned color, clear of the tile frame. Overflow
shares the final right-hand slot as a visible stack. On turn change the
active card exits left, the next one expands, and the combatant that just acted
appears at the queue tail. NPC letters remain emphasized before names on the
active card and share the same filled badge treatment in both positions; only
their size differs. A persisted health setting can show either numeric current/max HP
or the worded bands `Здоров`, `Ранен`, `При смерти`; another flag enables a
separate graveyard. The graveyard sits at the lower right and grows upward as a
vertical list bounded by the lower region; excess groups are summarized as
`Ещё N групп`. It groups dead NPCs by bestiary type and renders each larger,
unframed row as a right-aligned name, unbacked icon and count. Health numbers are omitted from
the public DTO unless health is enabled in numeric mode. Initiative values are
not included in the public projection. A failed refresh keeps the last
successful snapshot visible and marks the connection as interrupted.

The authenticated session page owns one typed SSE invalidation stream for the
participant list, character versions, timeline and public-screen presence.
Writes remain REST mutations and the stream contains no character or timeline
payloads; it only identifies the projections that need refreshing. Bursts are
coalesced by domain and character id. On reconnect the page reloads membership,
timeline cursor and screen presence, while ordinary idle time produces no API
requests. While SSE is disconnected, a bounded exponential fallback performs
the same catch-up reads until the browser reconnects. Character refresh still
uses the version-aware batch endpoint, but
only for ids named by an invalidation. Membership snapshots include each
character's technical version.

The DM header control tracks the live number of public screens connected to that
session. Its button uses a green connected treatment whenever at least one SSE
subscriber exists, while the popover reserves its primary status row for the
current display mode and visibility. Connection state updates from the
authenticated session stream whenever a public display subscribes or
disconnects; reconnect catch-up reads the owner-only counter once.
Each public browser tab counts as one screen. This counter comes from the
in-process SSE hub rather than the database, so it
reflects current connectivity and naturally resets during a server restart;
screens reconnect automatically and reappear in the counter.

The display popover keeps the current mode, an icon-only blackout/reveal toggle,
the contextual material removal action and an illustrated visual-effect grid on
its main level. A dedicated settings button opens a nested settings level for
all persisted toggles: remote music, health and its numeric/worded mode, and the
graveyard. The same level provides a `75–125%` combat-display scale slider in
five-percent steps with a one-click reset to `100%`. The scale is stored with the
session presentation, rescales the complete combat stage around its center
(subject to the viewport fit limit) and
feeds the effective logical width back into queue capacity calculation; material
playback and fixed timer overlays retain their full-screen geometry.

The public endpoint builds a dedicated projection on the server rather than
returning raw encounter or character JSON. It may resolve the session owner's
referenced custom bestiary entries and condition suggestions, but exposes only
their display fields and condition label/color. Exact current/max HP is projected
only when the master enables health in numeric mode. Player maximum HP uses
the current sheet format: nonnegative `hp.max.base` plus signed integer
`hp.max.bonuses[].value`, clamped at zero. No login on the display is required.
Character sheets,
initiative values, AC, notes and challenge
results remain private.

The encounter never embeds `itemRaw` and does not read denormalized NPC fields.
Startup SQL converts previous records to `itemId + override`; frontend only
batch-loads referenced handbook items through `/api/items/by-ids`.

Player display and HP come through `participantView`. HP writes use the
accessor's canonical `hpPath`; current/temp HP and death saves are patched back
to the character only when the current user may perform the action. A player at
zero HP is summarized in the participant rail as `При смерти` with compact
success/failure counts instead of death-save pips. The DM can start revival from
that tile. Every player or NPC revival action first asks for the resulting HP;
player HP and cleared death saves are patched to the character, while NPC HP is
stored in encounter state.
The player color marker is read from `session_participant`, not copied into the
encounter combatant, so changing it is reflected across every encounter section.

## Music

`SessionMusicWorkspace.vue` is the central content of the `Музыка` tab; the
previous fullscreen library modal and the player-panel launch action do not
exist. Its nested tag and album dialogs use `AppModalFrame`. Album/track/tag CRUD uses shared
prompt/confirm dialogs; track ordering uses `useSortable`. Playback state
is synchronized through the session music endpoint, while track files and
signed URLs are served by `/api/music`.

The library contains albums, tags, queue/current track, volume, loop and
crossfade controls. File upload validation is part of the upload composable/API;
browser prompt/confirm is not used.

Every authenticated library also includes read-only system albums. Their tracks
can be played and queued in a session, but the UI and API reject renaming,
deletion, tagging, membership changes, and reordering. System album headers show
the source and CC0 metadata; system audio is served through signed S3 URLs.

## Data changes

Runtime accepts only current session/encounter JSON. If the encounter model
changes, add a new ordered migration in
`internal/store/schema/`, update all producers/consumers, then
remove the previous keys and any read-time converter.

Первое открытие сессии, приглашения, мира и рабочих разделов использует LoadingState вместо произвольных skeleton-карточек. Общие индикаторы применяются к загрузке изображений и операциям в контролах; реальный прогресс и статусы соединения сохраняются.
Общий контракт: [состояния загрузки](../loading-states.md).

## Обучение

Первая загрузка сессии показывает отдельный сценарий для игрока или мастера.
Система сессии, роль и мобильная/компьютерная раскладка имеют независимый
прогресс аккаунта. Повтор запускается из настроек сессии; игроку доступна кнопка
«Настройки» в шапке. `useSessionPage` компонует состояние страницы, а сценарии
и их UI-действия находятся в `features/tutorials`. При правках интерфейса,
переходов и прав нужно одновременно обновить [обучение](tutorials.md).


## Передачи предметов

В собственном листе участника блок сессии открывает игроков (иконки и имена)
и «События» с незавершёнными передачами. Вещи, оружие и зелья передаются целой
стопкой через меню предмета. На время ожидания экземпляр хранится сервером;
получатель принимает или отклоняет его, отправитель может отозвать запрос.
Хроника получает один `item_transfer` с именами отправителя/получателя и
количеством: статус этой же записи обновляется `pending` → `accepted`/`rejected`.
В UI это «Ожидает» / «Приняли» / «Отказали», включая отзыв. Событие относится
к фильтру «Персонаж», справочный предмет открывается обычной ссылкой хроники.
Изменение статуса и соответствующего инвентаря публикует SSE journal/characterIds.
Инкрементальная загрузка хроники возвращает изменяемые передачи отдельным
массивом `updates`, чтобы сохранить ID, порядок и курсор новых событий.

Незавершённые передачи блокируют удаление/выход участника, перенос персонажа
в другую сессию и удаление персонажа или кампании с HTTP 409. Сначала получатель
должен ответить, отправитель отозвать запрос либо мастер принять его из хроники. Подробности хранения экземпляров — в описании листа персонажа.

Передача в хронике показывает аватар и снимок имени получателя после стрелки;
отправитель уже указан в колонке автора и в деталях не повторяется. Статус
выделен иконкой и цветом: ожидание — warning, принятие — success, отказ — danger.
`recipientImageUrl` вычисляется по текущей иконке получателя с fallback на портрет.
У мастера рядом с ожидающим статусом есть «Принять»: предмет получает
указанный получатель, статус той же записи становится принятым, оба листа
обновляются по SSE. Кнопка блокируется во время запроса; повторное принятие
безопасно, уже отклонённый запрос принять нельзя. Сервер проверяет владельца
именно этой сессии. Обычные события хроники не требуют одобрения.
Отправка из листа выбирает адресата в подменю с иконками 48 px. Поповер событий
показывает сверху «→ получатель с иконкой» у исходящих или «отправитель с иконкой →» у входящих; предмет находится отдельной строкой, без подписи
«Ожидает вашего решения».

Запрос применения зелья использует то же событие `item_transfer` с
`data.purpose=use`. В хронике показано «Применение», имя цели и состояние:
«Ожидает», «Использовано» либо «Доза возвращена». Входящий запрос попадает в тот
же список событий персонажа и вызывает уведомление со ссылкой «Открыть события».
У мастера кнопка называется «Принять» и подтверждает расход для
указанного получателя. Принятие применяет сохранённый план лечения/эффектов и
не добавляет зелье в инвентарь. Перед решением показаны формулы, эффекты,
длительность и оставшиеся ручные условия; после — результат бросков. Незавершённое применение имеет ту же защиту
от удаления участника/сессии и тот же обмен обновлениями SSE, что и передача.


Логика переходов графа вынесена в `useSessionGraphEdgeActions`; SessionGraphCanvas координирует canvas и редактирование. CSS toolbar боя находится в EncounterToolbar.css, остальная раскладка — EncounterTab.css. Меню строки передаёт расположение через ActionMenu.triggerAttrs, без дополнительного DOM-контейнера.

## Чат и камень / ножницы / бумага

В собственном листе блок «Сессия» → «Другие игроки» открывает меню каждого
участника с пунктами «Чат» и «Камень / ножницы / бумага». Общение привязано к
паре персонажей и текущей сессии. Чат и игра открываются в отдельных `AppModalFrame`
без переключателя режимов; история чата загружается страницами по 50 записей.
В шапке чата — аватар и имя получателя, у сообщений слева от разделителя —
аватар отправителя без подписи. Завершённые партии показаны компактными
карточками с аватарами, именами, иконками ходов и VS; победитель выделен зелёным. Сообщения
принимаются как обычный текст до 2000 символов, отображаются с сохранением
переносов и безопасным экранированием HTML. Ошибка отправки сохраняет черновик;
повторная отправка того же действия использует прежний `clientActionId`.

Колокольчик в листе объединяет передачи, непрочитанные входящие сообщения и
незавершённые вызовы обеих сторон. Сообщения одного отправителя сгруппированы
в одну строку. Чтение открытой вкладки чата сохраняется на сервере только до
показанного ID; сообщения, пришедшие позднее, остаются непрочитанными. Обновление
журнала через SSE обновляет переписку, счётчик и вызовы; переподключение дочитывает
состояние. Непрочитанные сообщения и входящие вызовы могут уведомлять при входе,
даже если общая хроника недоступна. При входящих уведомлениях колокольчик ярко
пульсирует; без входящих гаснет. Reduced motion заменяет пульсацию статичным свечением.

Отправитель сразу выбирает ход. Между парой может быть один ожидающий вызов,
включая обратное направление. Получатель отвечает своим ходом или отклоняет
вызов; отправитель может отозвать его. Сервер определяет победу или ничью и
атомарно завершает партию. До ответа ни один API, включая хронику мастера,
не раскрывает ход отправителя. Отклонение и отзыв также не раскрывают его.
В окне игры ход выбирают крупной SVG-иконкой камня, ножниц или бумаги.
Результат показывает участников и ходы через VS, с зелёной рамкой и лёгким фоном
победителя. При ничьей оба участника без подсветки. «Ещё раз» открывает новый выбор.

Хроника мастера показывает каждое сообщение (`chat_message`) и один изменяемый
`rps_challenge` на партию: ожидание, оба хода и победитель/ничья либо отказ/отзыв.
Фильтр «Общение» выделяет эти записи. Имена обоих персонажей сохраняются снимками.
Их видят участники пары и мастер; другие игроки и анонимный экран не получают
переписку. Обычный POST событий не принимает эти типы: доступ, роли сторон и
результат игры проверяют отдельные серверные endpoints.

Инициатива в хронике выделена в самостоятельную группу с иконкой
`/static/initiative.svg` и единственным заголовком «Инициатива». Броски с этим
названием из листа и боя не объединяются с проверками ловкости, хотя используют
её модификатор. Повторной подписи действия под заголовком нет; результат и время
броска сохранены. Это представление применяется и к уже записанным событиям.

## Инвентарь сессии и решения в хронике

В правой колонке мастера есть «Инвентарь»: popover `SessionInventoryControl`.
Мастер добавляет предметы, оружие, зелья и магические предметы через штатный
`ItemPickerModal` с настройкой экземпляра либо создаёт собственный предмет с
названием, количеством и описанием. Справочник добавляет по одному экземпляру;
стопки, полученные от игроков, сохраняют своё количество. Строка открывает
справку. Предметы показаны компактным вертикальным списком на `ObjectListItem`: иконка,
название с многоточием при нехватке места, количество и фиксированные действия
справа — удаление и иконка «Передать». Подменю получателей открывается отдельно
от строки и не меняет её ширину, в том числе на телефоне.
Выбор получателя сразу резервирует экземпляр до ответа. При отказе он возвращается
в инвентарь, при принятии — попадает в соответствующий раздел листа получателя.
Мастер может отозвать исходящее предложение. Инвентарь доступен только мастеру.

Входящие передачи мастеру (`purpose=transfer`, `recipient_char_id IS NULL`)
принимаются в инвентарь сессии из этого поповера или из хроники; выбор NPC
остаётся только у запросов применения (`purpose=use`). Отказ возвращает предмет
игроку. Все решения и изменения листов выполняются одной транзакцией, статус
меняет ту же запись хроники. SSE обновляет открытый инвентарь и листы участников.
Повторы запросов не добавляют предмет повторно; при ошибке UI сохраняет действие
и предлагает повторить с тем же идентификатором.

У любого ожидающего предложения в хронике мастер видит «Принять» и «Отказать».
Они используют тот же `TransferDecisionActions`, что события листа: обычная
основная кнопка и quiet-кнопка отказа, без уточнений «применение»/«передача».
Сегодня справа у записи показывается время; в другие дни — дата и время,
а при отличающемся годе также год. Используется локальный календарь браузера.

В окне «К кому применить» цели идут вертикальным списком на всю ширину: у
персонажей и NPC показан портрет/иконка (при отсутствии — стандартная иконка).
Цветная буква NPC стоит перед именем. Под именем у всех показаны текущие и
максимальные хиты: та же полоска `SessionHpBar`, что в блоке игроков, с числами
справа. Временные хиты — отдельный сегмент и число при наличии; неизвестные хиты — «—».
Нажатие на строку сразу применяет эффект к выбранной цели.

### Participant menu and multi-selection

`ParticipantMenuStats` loads the participant's abilities, equipment, armor bases
and effects on opening the menu. `participantDefenses` uses the shared equipped
armor and derived-effect calculators. Passive Perception (Wisdom, skill 10) and
Investigation (Intelligence, skill 9) are 10 plus the skill modifier, proficiency
or expertise, manual bonuses and configured derived skill bonuses. The stored
skill mode and active roll-mode effects add 5 for advantage or subtract 5 for
disadvantage; opposing automatic modes cancel. Conditional scene modifiers are
set manually. Text-only handbook bonuses and optional extra dice are not inferred
as permanent numeric bonuses. The value's tooltip shows its calculation.
Source: [2014 passive checks](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/using-ability-scores#PassiveChecks).

`EncounterInitiativeMenu` is shared by the participant menu and creature-row
menu before combat. `rollCombatantInitiative` changes only that creature; combat
start preserves an already assigned initiative. Existing mass initiative actions
remain available.

Ctrl + click (Cmd + click on macOS) toggles selection in the participant rail when combat controls are
available, in encounter rows and in `SessionTargetPicker`. The shared
`handleCtrlSelection` consumes the gesture before menus, native checkbox
activation and drag start, including macOS's Cmd-click and Ctrl-contextmenu events. Locked or
read-only selection stays unchanged. Ordinary clicks keep their existing behavior.

Player menu statistic tooltips use the shared FloatingTooltip above the action menu (9500 vs 9300), including keyboard focus.


During active combat, a reserve player's rail menu offers «Отправить в бой» with an initiative field and «В бой». It reuses a prepared or manually entered value (including zero), or rolls when the field is empty. A sheet initiative roll carries `sheetInitiative: true`. Encounter reads project unacknowledged rolls into reserve player initiatives; saves acknowledge `sheetInitiativeCursor`. Rolls made for an active or dead combatant are acknowledged without replacing their initiative. Save projection checks the old roster before a pending move. Master-generated rolls do not carry this marker. Live journal updates flush local edits, then refresh the encounter.

Chronicle attack target controls share the roll's row on the right, with chosen targets below. Choose targets, apply to targets and roll-save buttons use the shared dashed ActionButton variant. The 680px target dialog keeps responsive viewport limits; all three flows use `loadSessionTargets`, the DM-only snapshot endpoint, hydrated equipment/effects, a common AC chip and medium HP bar. SaveFormulaPreview renders the same profile used for rolling, including extra dice and whether the higher/lower of two d20 is kept. Presentation AC and snapshots are excluded from submitted target identities.


### Контекст и результаты выбора целей в хронике

Все три окна (атака, спасбросок, применение урона/эффекта) используют
`SessionTargetContext`: иконка и название исходного предмета/способности либо
автор события, название действия, затем кубики исходного броска. Для события
без кубиков показывается характеристика и Сл спасброска, если они есть.
Выбранные цели атаки расположены построчно под ней, вдоль красной вертикальной
линии; слева от линии — мечи.

`/save-targets` исключает игроков и NPC с `position: dead` из последней
неудалённой сцены. Сохранение целей атаки, спасбросков и новое применение также
проверяют этот список. Нулевые хиты сами по себе не исключают цель. Общий список
`/application-targets` для принятия зелий/заклинаний сохраняет прежнее поведение.

`DamageImpactBar` использует средний `StatBar`: оставшиеся хиты и красный участок
потерянных хитов на общей шкале максимума, над участком — «Урон −N». Размер
участка вычисляется из хитов до/после: временные хиты и избыточный урон не
увеличивают его. Поглощение временными хитами отображается отдельно.

Формула урона заклинания сохраняет тип и цвет каждого слагаемого, включая
модификатор характеристики и числовые бонусы. Они входят в тот же `byType`, что
кубики соответствующего типа, поэтому сопротивление/уязвимость учитывают весь
урон. Крит удваивает только кубики. Уже записанные броски не пересчитываются.

## Редакция сессии и смешанная группа

Редакция выбирается при создании и хранится в `session.source_version_id`.
Прежние DND-сессии используют 2014. Каталог общих материалов наследует редакцию
сессии; открытый лист — собственную редакцию. При присоединении персонажа другой
редакции интерфейс предупреждает об отличии, но не конвертирует его. Snapshot
цели содержит `rulesVersion`; расчёт КД и штрафа истощения в спасбросках
использует правила цели. [Подробности](rules-editions.md).
