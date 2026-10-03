# Экран игроков и рабочее место сессии

Игровой стол, настройки видимости, публичная трансляция, состояние игроков и музыка.

← [Игровые сессии](../sessions.md)

## Содержание

- [Игровой стол](#игровой-стол)
- [Настройки видимости игроков](#настройки-видимости-игроков)
- [Экран участников](#экран-участников)
- [Музыка](#музыка)
- [Инструменты мастера и рабочая область](#инструменты-мастера-и-рабочая-область)

## Игровой стол

Раздел пока открыт только мастеру с ролью `ADMIN`. Остальные видят серую
вкладку «Карта» с подсказкой «Скоро будет»; она не переключает рабочее место.

Вкладка мастера «Карта» добавляет карты из библиотеки `/maps`, расставляет
жетоны игроков и существ encounter, управляет зонами тумана и интерактивными
объектами. Копия карты, двери, расстановка и видимость сохраняются в сессии.
После первого открытия вкладка сохраняется при переходах к сюжету и бою.
Трансляция `/map-screen/:code` имеет отдельную камеру и калибровку под
физические миниатюры; основной экран сессии не переключается.
Подробности: [игровые карты](../maps.md). Материалы типа map остаются раздаточными
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
uses three adjacent columns: the current chapter image/arc/title, the group
roster and a read-only meeting list. The list shows chronological past, next and
future meetings with their number, name and date. It does not display or load
diary entries and its rows do not open them. Every roster row shows the canonical character icon,
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
серверному разрешению; чат, игры и «Дать денег» остаются доступны независимо от этого флага.
Строки этого поповера показывают иконку 48 px, имя и разрешённые HP через
`SessionHpBar`, без класса, расы и троеточия. Перевод денег между участниками
сразу изменяет оба кошелька и сохраняется в хронике с отправителем, получателем,
валютой и суммой; запись видят оба владельца и мастер. Подтверждение получателя
не требуется, настройки передачи предметов на деньги не распространяются.

В этой же вкладке — `combat.autoRollNpcHp`, автоматический бросок HP существ
(по умолчанию выключен), и повтор обучения. Все пять параметров общие для сессии;
`localStorage` не используется. Содержимое вкладки центрируется в общей области
`SessionTabWorkspace`, максимальная ширина — 760px. Настройки видимости не меняют оформление анонимной трансляции:
у экрана показа свои параметры.

## Экран участников

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
Кнопка сокровищ открывает [генератор](../master-tools.md) с фильтрами, броском монет,
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
`Дневник` открывает единый `SessionJournalWorkspace` через `Alt`/`Option` + `7`.
Список встреч и записи находятся в двух непрозрачных `BaseTile`. Встречи идут
хронологически: прошедшие сверху и приглушены, затем следующая и будущие;
заголовок группы соединён линией со счётчиком. На узком экране список заменяется
поисковым выбором. Отступы от панели игроков и предельную ширину задаёт
`SessionTabWorkspace`; список и записи прокручиваются независимо.

Только DM меняет встречи и управляет `Игроки могут редактировать дневник`
под значком настроек блока записей. Выключение оставляет игрокам чтение,
но запрещает изменения на сервере. Записи выбранной встречи используют общий
`JournalTimeline`, как дневник персонажа: новые сверху, полное содержимое,
добавление, фильтры и управление порядком над лентой.

Хроника и дневник используют `share-ui/TimelineGroup`: слева — identity
с цветным соединителем, справа — заголовок и содержимое, снизу — разделитель.
В хронике identity содержит субъекта и автора, в дневнике — иконку типа.
У записей дневника нет отдельных цветных рамок и центральной линии; цвет
сохраняется в иконке и соединителе. Карандаш открывает полноширинный редактор
со всеми полями и сохранением/отменой.
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
Подробнее: [Дневники](../journals.md).
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

## Музыка

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

`features/maps` содержит библиотеку, редактор, рабочее место сессии и отдельный
экран стола. `MapAvailabilityGate` использует общий `FloatingTooltip` для
подсказки «Скоро будет», блокирует активацию недоступного пункта и сохраняет
фокус с клавиатуры. Меню, сессия и прямые страницы проверяют `ADMIN`; это
доменное ограничение раннего доступа, не новый базовый tooltip-компонент.
PixiJS 8 рисует слои карты через WebGL; Canvas2D используется для
генерации текстур, масок и миниатюр. Движок, редактор и экран входят в единый
production JS; компоненты монтируются при открытии соответствующего интерфейса.
Формы и панели используют `ActionButton`, `AppModalFrame`,
`ConfirmDialog`, `BaseTile`, `MultiToggle`, `ToggleSwitch` и поля share-ui.
Локальные pointer-жесты нужны для координатного рисования, камеры и размещения
жетонов на WebGL canvas, а не для обычной сортировки DOM-списка.
Модель, сохранение и renderer разделены; [контракт и UX карт](../maps.md).

В сессии `features/sessions/components/SessionTabWorkspace` задаёт единый фон,
отступ от панели игроков и максимальную ширину 1440px для вторичных
вкладок, включая дневник. Внутри этой области хроника ограничена 980px. Внешний отступ составляет 28px на desktop (в том
числе от видимой панели игроков), 16px на mobile. Он оборачивает слот `primary-workspace` в
`ChapterGraphTab`; сюжет и бой остаются за его пределами. Содержимое вкладок
отвечает только за внутреннюю компоновку и прокрутку, не повторяя safe-area
отступы (подробнее — [sessions](../sessions.md)).

`SessionHpBar` — единая строка здоровья для `SessionParticipantCard` и выбора
цели применения: `StatBar size="small"`, цвет по доле здоровья, временные хиты
отдельным сегментом и числа справа. Геометрия, цвета и расчёты общие; состояние
«При смерти» в карточке игрока остаётся отдельным.

## Инструменты мастера и рабочая область

`features/master-tools` содержит генератор сокровищ для правой панели сессии. Отдельная страница инструментов, ночлег и странствие удалены. Чистая генерация находится в `lib`, состояние — в `useTreasureGenerator`, форма — в `components`. `SessionToolsRail` сохраняется на всех вкладках; `SessionTreasureControl` держит состояние вне поповера и модальный просмотр предмета. Настройки сессии — отдельная вкладка на общих `BaseTile`, `FormField` и `ToggleSwitch`, центрированная внутри `SessionTabWorkspace` с максимальной шириной 760px. `useSessionSettings` читает разделы `players` и `combat` из сессии и сохраняет отдельные пути через API; браузерного хранения настроек нет. Запуск и копирование используют публичный `share-ui/ActionButton` (0.19.0). Контракт — [инструменты мастера](../master-tools.md).

## Связанные страницы

[Оглавление wiki](../../README.md) · [Игровые сессии](../sessions.md) · [API: сессии и сцены](../../api/sessions.md)
