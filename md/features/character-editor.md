# Лист персонажа: устройство и интерфейс

Точка входа для работы с листом: доступ, реестр шаблонов, раскладка и режимы просмотра. Формат документа, игровые механики и взаимодействие игроков вынесены в тематические страницы.

## Содержание

- [Реестр настроек](#реестр-настроек)
- [Отрисовка листа](#отрисовка-листа)
- [Общие UI-требования](#общие-ui-требования)
- [Форматированные описания](#форматированные-описания)
- [Проверки](#проверки)
- [Загрузка листа](#загрузка-листа)
- [Первое знакомство с листом](#первое-знакомство-с-листом)
- [Единые плитки и режим просмотра](#единые-плитки-и-режим-просмотра)
- [Загрузка мобильных панелей и локальных снимков](#загрузка-мобильных-панелей-и-локальных-снимков)
- [Группы строк на листе персонажа](#группы-строк-на-листе-персонажа)

## Разделы

| Страница | Содержание |
| --- | --- |
| [Документ персонажа и сохранение](character-editor/data.md) | Канонический D&D JSON, semantic accessors и синхронизация. Здесь находится основной frontend-контракт документа. |
| [Создание, уровень и отдых](character-editor/progression.md) | Идентичность, мультиклассирование, создание документа, повышение уровня и восстановление ресурсов. |
| [Способности, ресурсы и эффекты](character-editor/abilities.md) | Источники способностей, выборы, защитные и производные эффекты, виджеты и действия листа. |
| [Инвентарь и оружие на листе](character-editor/equipment.md) | Экземпляры вещей, экипировка, вес, оружейные броски и композиция предметных меню. |
| [Магия и редакция персонажа](character-editor/magic.md) | Меню заклинаний, параметры бросков, цепочки атак и профиль правил редакции. |
| [Взаимодействие игроков из листа](character-editor/interactions.md) | Передача вещей и денег, чат, вызовы и права участников текущей сессии. |

Лист с выключенной «Публичной ссылкой» доступен владельцу и мастеру сессии,
в которой участвует персонаж. Доступ мастера действует для неудалённой сессии
и не зависит от публичности листа; проверка применяется также к чтению версии.
Другие игроки могут открывать чужой лист только при включённой публичной ссылке.

Character editor lives in `frontend/src/features/character-editor`. It is a
recursive code-schema renderer shared by supported game systems, not a set of
DB-defined templates.

## Реестр настроек

`settings/index.js` maps `char_template.name` to:

- render schema/layout;
- semantic accessors;
- source name/version;
- optional simple create payload.

Registered systems are D&D 5e (`DND5`) and VTM V20 (`VTM20`). D&D schema is
assembled by `settings/dnd/schema.js` from `blocks.json`, `desktop.js` (композиция `desktop/stats.json`, `main.json`, `sidebar.json`) and
`mobile.json`; VTM schema is imported as a code resource. Unknown template name
is rejected. DB template schema, create form and path maps do not exist.

## Отрисовка листа

`ViewCharacter.vue` owns page orchestration. `useCharacterData` loads the
character, resolves setting schema/accessors, exposes `charCtx`, sessions,
ownership and save state. Header/list/session identity all use the same semantic
accessors; layout JSON does not contain a second title resolver.

`TemplateBlockInner.vue` recursively renders layout nodes and blocks registered
in `blockRegistry.js`. Generic blocks live in `blocks/generic`, D&D blocks in
`blocks/dnd`, VTM blocks in `blocks/vtm`. New blocks are registered once and
receive data by block id.

Desktop and mobile share block definitions but have separate placement
profiles. The desktop base layout moves class, race and feat entries out of the
side column into the visible inner **Способности** tab alongside **Оружие**,
**Магия** and **Снаряжение**. It shows expanded cards with a 64×64 handbook icon
and the full description inline. Class abilities, racial abilities and feats
each own one shared tile; entries inside it do not create nested backgrounds or
outlines and are divided by thin separators. Their rich descriptions use the
same muted `--text-2` tone as action-row descriptions. Each tile header has a compact
dashed plus control for adding an entry and no edit pencil. The tiles reactively
load handbook records for entries added by another sheet flow, so a feat gained
during level-up appears immediately without a reload. Clicking an ability opens
the shared row-action menu with **Посмотреть**, an owner-only
**Использовать** action when the ability has exactly one available resource,
and owner-only **Удалить**. Use spends that same normalized resource shown in
the resources block and records `resource_used`; abilities with several
independent resources remain usable from the resources block so the target
counter is explicit. Short- and long-rest recovery are shown immediately to the
right of the ability name with the same cup and moon icons as action rows.
Feature widget toggles record `feature_state`, while
linked spell-effect changes record `status_effect`; both are accepted by the
atomic character-save event contract. The desktop base page is one continuous
three-column row: characteristics on the left, identity/HP/statuses/inner tabs
in the flexible centre, and utilities plus feature widgets, actions, resources,
defenses and proficiencies in the right column. Both side columns use the same
20 px inner padding, so their content has matching spacing from the centre; the
right utility content remains 320 px wide. AC, initiative, menu, speed,
proficiency bonus and rest share one `BaseTile` in a gapless 3×2 grid with
1 px internal dividers. All six cells use `UtilityCell` over the shared
`ActionButton quiet`: the whole cell has the same hover, focus and keyboard
activation. Metric headings use `MorphTileHeader` without pencils; inline dice
buttons are hidden. Clicking initiative or proficiency bonus opens a
`RowActionMenu` with owner-only «Изменить» and «Бросить кубик», which remains
available on read-only sheets. AC and speed open their editors directly; menu
and rest keep their own menus. «Меню» and «Отдых» center their icon and label
vertically within the cell using equal 12 px top and bottom padding. All six icons use
a fixed 20×20 px area and the same 4 px gap before the value or label. Cells
have 12 px bottom padding and 70 px row
height; the separate full-width level tile below remains 64 px high. The former
whole-tile morph editor is not used.
The renamed mobile **Способности** tab uses the expanded cards as well and
starts with prominent feature widgets, actions, resources, defenses and
proficiencies. The mobile D&D stats tab uses a 12px top-level column gap. Tab state
is encoded in the route query. `CharacterTabPane.vue` owns
one tab pane; swipe/drag logic is extracted into composables. On mobile, each
tab owns its nested scroll position and keeps `--bg` as its canvas. Content is
split into semantic `--surface` blocks instead of painting a whole tab: every
weapon is a card; spell parameters, slots and each spell level are separate
cards; inventory spaces share one tile while utility widgets are separate; the personality
profile declares the `Основное`, `Облик`, `Характер` and `История` tile groups
in `mobile.json`. The character route hides the global app header at the mobile
breakpoint and gives the full viewport to its own toolbar; that toolbar menu has
an explicit **К персонажам** action, including on read-only public sheets. Its
desktop shell also occupies the full viewport because application navigation is
provided by the fixed side rail and does not reserve a top-header offset. Its
desktop identity summary uses the top-aligned frameless dedicated character icon to the left of the
visible name, race, class list and HP. The full portrait lives in the inner **Личность** tab beside the
appearance fields. The class list stays below the name and race and wraps by
whole class entries without increasing the sheet width; an individual entry
that is wider than the available row is ellipsized. The active tab still registers its DOM scroller
through `useAppHeaderCollapse` so
the compact common strip has one shared scroll/settle observer; regular routes
keep the header in document flow. Completed tab changes are pushed into the
`tab` route query. Browser Back and Forward therefore restore prior tabs (even
after rapid history navigation), while **К персонажам** provides a direct exit
to the character list.
Desktop `LayoutInnerTabs` groups also keep their selected pane in independent,
schema-stable `innerTab-*` query keys. Reload and browser history restore both
the outer character tab and its inner pane; invalid or stale inner indexes fall
back to the first pane. Every weapon uses its own shared desktop/mobile `BaseTile`.
Кошелёк расположен сверху справа внутри общей карточки предметов на desktop
и mobile: иконка кошелька и суммы монет без отдельного заголовка и подложки.
Иконка владельца открывает калькулятор мышью и с клавиатуры; режим просмотра
показывает статичную иконку. Кошелёк доступен и во время загрузки инвентаря.
Его изменения сохраняются через `charCtx.updateValues` в прежний `values.money`.
В разделе снаряжения доступны кошелёк и рюкзаки. Запасы учитываются количеством
предметов в ячейках; отдельные пользовательские плитки и их редактор удалены,
включая представление для печати.

Все пространства предметов собраны в одном `BaseTile`: разделённые заголовками
и линиями с названием рюкзаки без режима списка и отдельной области «Экипировано».
Справа в заголовке каждого пространства показаны иконка гири, суммарный вес
и единица «фунт.», без текстовой подписи. Счётчика предметов рядом с названием нет.
Сумма включает надетые вещи в этом пространстве и учитывает количество,
неполные упаковки, длину и ручной вес
экземпляра; вещи без заданного веса не добавляют вес. Пустое пространство
показывает «0 фунт.». Разделитель перед удалением есть только вместе с кнопкой.
Число колонок зависит от ширины пространства (ячейка от 72 px, зазор 8 px).
В пустой ячейке сумка плавно сменяется плюсом при наведении/фокусе; меню предлагает
справочник и собственный предмет. Форма своего предмета позволяет задать
необязательный неотрицательный вес одной штуки в фунтах, включая дроби и ноль.
«Изменить» сохраняет или очищает этот вес; он входит в сумму пространства
и подсказку всей стопки. `prefers-reduced-motion` отключает переход.
Наведение на предмет показывает описание, стоимость и вес; нажатие открывает
меню с названием, отделённым стандартным разделителем. Скругление источника
остаётся прежним при открытом меню.
Рамки всех ячеек имеют толщину 2 px. Упрощённые вещи отмечены пунктиром
того же цвета, что обычная рамка. У надетого упрощённого предмета рамка
остаётся пунктирной и становится фиолетовой. Количество больше
единицы показано в чипе, прижатом к правому нижнему краю: скруглены верхний
левый и нижний правый углы. Длинное число сокращается, полный счёт доступен
в подсказке и описании для screen reader. Снизу слева общий чип показывает
иконки футболки («Можно надеть») и ладони («Можно использовать»). Та же ладонь
обозначает «Использовать» у способностей и «Использовать на…» у предметов. Надетая
футболка подсвечена акцентом; фиолетовая рамка сохраняется. Теги отражают
механики справочника, видны владельцу и читателю, а у просроченной созданной
вещи значок применения скрыт. Пресет одежды не добавляет механик экипировки.
Пункт «Экипировать» доступен владельцу у оружия, доспехов и магических предметов,
которым нужна экипировка (включая отдельные зависимости `activation=equipped`).
У уже надетого экземпляра доступен «Снять». Обычные вещи и зелья этого пункта
не имеют. Надетая вещь остаётся в своей ячейке с фиолетовой рамкой 2 px;
экипировка меняет состояние экземпляра целиком, сохраняя UID, количество,
параметры и заряды. Настройка на персонажа остаётся отдельным действием.
`items.equipped` остаётся источником механик КД и магии. `sections[].slots`
хранит позиции всех вещей пространства, включая UID из `equipped`; исходные
надетые вещи без позиции показываются в первом пространстве. Перенос между
сетками меняет физическое место, сохраняя статус экипировки. Сетка допускает
пустоты и обмен занятых ячеек; новый ряд появляется после заполнения последнего.
Изменение ширины меняет только число колонок, а не сохранённые индексы.
Удаление пространства удаляет все его вещи, включая надетые. Viewer видит
раскладку и статус, но не может переносить, добавлять или менять экипировку.
Escape, отмена жеста и отпускание вне ячеек отменяют перенос.
Fixed equipment utilities and personality groups use independent surfaces,
spell parameters/slots use separate `MorphTile` cards, and diary collections keep
their own cards while notes have a dedicated surface. The desktop character
page uses the same subtle 24px dot pattern as the session chapter canvas on its
global `--bg` backdrop; the central tab remains transparent, and its cards do
not merge back into one large tile. Desktop tab labels share
the same muted, fixed-weight typography so the active, fully rounded 3px underline
changes state without shifting label geometry; the tab group has no outer
horizontal padding and aligns directly with the central column. Mobile uses the
same outer `tab` route contract.
The sticky mobile tab chrome ends with a narrow static masked blur and subtle
`--scrim` darkening over the scrolling content; only that 18px strip uses
`backdrop-filter`, with a plain dark gradient as the unsupported-browser
fallback.
The character viewport keeps its pre-keyboard height while a rich-text or form
editor is focused. `useCharacterViewport` owns the visual/layout viewport
synchronization and document-scoped focus handling needed by editors teleported
outside the page root.
Character autosave starts one second after the latest edit. The settings menu
shows only pending or active saving; idle success is silent, while a failed save
opens a separate retryable alert. Custom-action requirements preserve spaces
and blank lines while typing, then trim empty rows when the field loses focus.
For an owner, clicking the HP tile opens its vertical editor with a container
morph from the clicked tile. The editor keeps the source tile width instead of
falling back to the narrow no-origin panel width. Its desktop face places the
heart and current/maximum/temporary numbers to the left of the health bar; it
does not render a textual health category or hit-die availability. Maximum HP is stored as
`max {base,bonuses}`. Below the calculator, the editor shows a maximum summary
with base and bonus totals, compact read-only ability contributions, and hit-die
pools with their type, remaining count and spend/restore controls. Single-class
and multiclass characters use the same pool layout; there is no die-type picker.
Base editing and manual bonuses live under **Настройка хитов**.
Hovering, focusing or tapping **Максимум хитов** opens a scrollable history with
class name, class level, total character level and HP gained. Character creation
records level 1; subsequent level-ups append their actual accepted HP gains.
Manual base edits append signed corrections. Existing unrecorded base is shown
as **База без истории**; past rolls and class order are never reconstructed.
Current ability and manual bonuses are listed separately in the history and
included in its total. The history uses `share-ui/BasePopover` above the morph
layer because it must support scrolling and touch, unlike the non-interactive
`ItemTooltip`. Healing, rests, level-up,
print and encounter projections use the resolved total; encounter writes never
overwrite the maximum's source structure.
The desktop effect summary sits inside the shared icon/name/HP `BaseTile`,
directly below HP, has 15 px left and bottom insets, and has no frame or
background of its own. The inset is owned by the rendered summary component,
because placement styles cannot fall through its fragment roots. Active catalogue
effects, non-zero exhaustion and heroic inspiration share one horizontally
scrollable row of 64×64 icons. Catalogue
cells render either raster `iconImageUrl` or SVG; missing media falls back to a
monogram rather than a colour dot. A frameless copy block to the icon's right
shows the item name, its dedicated `data.thesis`, and an optional live level.
The thesis is deliberately one short phrase and is rendered in full without a
line clamp. Owners add entries through the dashed **Состояние** cell at the
right edge, after active entries. Clicking an active
entry opens one row-action menu with handbook view and removal; exhaustion and
catalogue effects that declare a level also expose increment/decrement actions.
Catalogue levels are copied into runtime status parameters, so changing one
character never mutates the shared item. Exhaustion and inspiration are system
effect items with their own icons and covers, while their live level/flag remain
in the existing rules-owned character fields for rest compatibility.
The compact mobile strip
keeps HP at its intrinsic number width and never lets
the HP numbers shrink. Its right side contains a fixed **Статусы** action
button with editors for conditions, exhaustion and heroic inspiration. Active
condition icons, a non-zero exhaustion level and active inspiration stay visible
in a horizontally scrollable summary; the non-zero exhaustion badge opens its
editor directly for an owner. The larger condition icons are frameless
and show the condition description on hover. Empty and zero values render no placeholder.
Heroic inspiration is stored as the boolean `values.inspiration`.

## Общие UI-требования

General-purpose labels, text, number, textarea and action rows use
the form primitives exported by `@sylvieshare/share-ui`; rule-specific
calculators, stat controls and file inputs may
own specialized controls. Regular windows use `AppModalFrame`, whose title,
close button and mobile handle remain fixed while the body scrolls. Direct
`AppModal` usage is reserved for specialized fullscreen workspaces. Confirm and one-line prompt use
`ConfirmDialog` and `TextPromptDialog`. Item detail uses
`ItemViewModal`, formatted descriptions use `InputDescription`/`RichContent`,
sortable collections use `useSortable`. Full selection rules are documented in
[frontend](../frontend.md).

Spellbook settings use `DndSpellbookSettingsModal`; both character settings
entry points reuse `ContentSourcesModal`. The wizard and character settings use
the item editor's `ItemSourcePicker` through `ContentSourceSelector`: a compact
trigger in the wizard and an embedded list in the settings dialog. “Выбрать все”
selects all books, independent of search; clearing it selects none. Character
settings retain the dynamic `all` mode and a separate Legacy switch.
Handbook item viewing and search are
independent `features/handbook` components. Character-specific item actions are
supplied through the detail modal footer instead of being implemented by the
handbook renderer.

Окна предметов восстанавливают фокус без прокрутки исходного листа. Общий
`RowActionMenu` раскрывается короткой анимацией из точки trigger с учётом
`prefers-reduced-motion`. Блок зелий отделён нижним отступом, а секция ячеек
заклинаний имеет явный заголовок и на desktop, и на mobile.

## Форматированные описания

Character notes/personality fields that are descriptions store the HTML emitted
by `InputDescription` and render through the DnD adapter over `RichContent`.
The toolbar inserts ordinary links plus atomic dice/item/suggest references;
selecting an existing reference offers change/delete actions. A field has one
schema key; components do not try `desc` and then `description`.

`person_alignment` is a fixed nine-value D&D enum rendered by the shared 3×3
alignment popover in both the character sheet and the creation wizard. The
print view renders larger, always-open spell-slot circles and gives inline rich
dice formulas a quieter paper style inside feature and spell descriptions.
Print CSS uses semantic `--font-print-ui`, `--font-print-display` and
`--font-print-prose` stacks. Their current Arial/Georgia values deliberately
preserve pagination; replacing them requires a rendered page-by-page review.

## Проверки

Pure mechanics have Vitest coverage next to their modules. Required checks:

```bash
cd frontend
npm test -- --run
npm run build
```

## Загрузка листа

Страница и полноэкранный CharacterSheetModal до получения character response
показывают общий `LoadingIndicator` по центру доступной области. После определения
шаблона синхронно выводится его настоящая desktop/mobile-структура; seed-переход
сразу показывает лист без промежуточной заглушки. Пока догружаются справочники,
локальные скелетоны на `SkeletonBlock` повторяют строки навыков, компактные или
развёрнутые карточки способностей. Инвентарь сохраняет названия и количество
секций и число предметов из данных персонажа, вместо трёх произвольных плиток.
Все анимации загрузки учитывают `prefers-reduced-motion`.

Ошибка начальной загрузки страницы или CharacterSheetModal останавливает индикатор и предлагает повторную загрузку. Повтор инициализирует вкладки и контекст листа после успешного ответа.
Общий контракт: [состояния загрузки](../loading-states.md).

## Первое знакомство с листом

Собственный лист запускает обучение с отдельным прогрессом для редакции и
мобильной/компьютерной раскладки. Повтор доступен в меню листа и настройках
аккаунта. Сценарий открывает UI без изменения игровых данных; при изменении
блоков и навигации его необходимо актуализировать одновременно.
Контракт и проверки: [обучение](tutorials.md).

## Единые плитки и режим просмотра

`BaseTile` — поверхность без встроенной полосы и заголовка. Полосы сохранены
отдельным `TileAccentStrip`. Морф-плитки и блоки параметров/ячеек магии используют
`MorphTile`: единый заголовок, опциональный карандаш и слот справа для метрик
или действий. Малые плитки используют `compactHeader` с уменьшенным текстом
и карандашом. Общего отступа под заголовком нет; характеристики сохраняют
расстояние через padding содержимого. Нажатия справа не открывают редактор заголовка. В режиме просмотра
редактирующие карандаши скрыты; броски остаются доступны по существующим правилам.

Над содержимым центральной колонки desktop, а на mobile сверху каждой вкладки,
показан «Режим просмотра», если нет права редактировать. Для гостя пояснение
«Вы не авторизованы», для вошедшего пользователя — «Этот персонаж принадлежит
другому игроку». На собственном листе блок скрыт.

В меню чужого листа на обоих устройствах есть «Клонировать себе». Авторизованный
пользователь создаёт собственную копию доступного ему листа и сразу переходит
к ней. Гостю предлагается вход/регистрация, затем действие можно повторить.
Копия получает имя с «(копия)», собственный UUID и владельца; участие в сессии
и запросы передачи не копируются. Закрытый лист доступен для клонирования
только владельцу или мастеру сессии, имеющему право просмотра.

При открытом собственном листе игрок получает уведомления о предложениях
предметов своим персонажам (статус `pending`), входящих сообщениях и вызовах,
а также об ответе соперника на свой вызов. Собственные действия и посторонние
события, принятие/отказ по обычным передачам не вызывают всплывашек. Успешное применение зелья или эффекта показывает уведомление с результатом; его кубики и эффекты остаются в хронике, включая применение на себя. Входящая передача
предлагает «Открыть события» для принятия или отказа.
SSE-invalidation журнала обновляет и список передач, и историю. Список передач
сам отправляет входящие предложения в общую очередь, даже при ошибке хроники.
Незавершённые адресованные предложения показываются и при первой загрузке;
дедупликация по пользователю, сессии и eventId не даёт двум источникам повторить
карточку. Обычная начальная история загружается без уведомлений. Собственный бросок не дублируется
уведомлением хроники после сохранения листа.

Поповер группы называется «Другие игроки», исключает текущего персонажа;
счётчик отражает этот же список. Иконки группы и событий стоят рядом слева.
В поповере событий передачи идут строками с горизонтальными разделителями,
без отдельных плиток. Строка имеет вид «{иконка и имя отправителя} предлагает
{иконка и имя предмета}», ниже — доступные действия. Подписи «Ожидает вашего
решения» нет; исходящая передача сохраняет состояние ожидания. Нажатие на
предмет закрывает поповер и открывает штатный `ItemViewModal`: справочную запись
по id или описание собственного предмета без id. Справочные иконки загружаются
пакетом; отсутствие рисунка заменяется иконкой предмета. `senderImageUrl` берётся
из текущей иконки персонажа отправителя с fallback на портрет.

## Загрузка мобильных панелей и локальных снимков

На мобильном листе сначала монтируется только активная вкладка. Первый переход, swipe или программное открытие в обучении монтирует целевую панель; посещённые панели сохраняются до закрытия листа. Геометрические контейнеры всех семи панелей остаются для циклического swipe.

`createCharacterSnapshotRecorder` объединяет изменения за 300ms, с максимальным ожиданием 1000ms. Последнее состояние сериализуется один раз, хранится не более трёх различных снимков; это локальная страховка, а не undo каждого нажатия. Незавершённая запись выполняется при скрытии страницы, pagehide и unmount. Режим просмотра не создаёт снимков. Ошибка localStorage не мешает редактированию.

## Группы строк на листе персонажа

Сетка layout-schema поддерживает `tile` для общей поверхности `BaseTile` и
`dividers` для внутренних линий по числу колонок. Desktop-группа КД, инициативы,
меню, скорости, бонуса умения и отдыха использует сетку 3×2 без зазоров;
её дочерние блоки получают `embedded` и не создают отдельные поверхности.
Локальный `UtilityCell` задаёт только геометрию ячейки: весь trigger использует
общий `ActionButton quiet` для hover, focus, disabled и клавиатурного нажатия.
Заголовки параметров используют `MorphTileHeader` без карандаша. Инициатива
и бонус умения открывают `RowActionMenu` с изменением и броском; меню и отдых
используют ту же кнопку. Режим `inline` у `UtilityCell` выравнивает
«Меню» / «Отдых» по центру ячеек по вертикали с отступами сверху и снизу 12 px: иконки
20×20 px в фиксированной области, зазор перед подписью 4 px. Открытый trigger
сохраняет подсветку через
`action-menu-source--open`, но не сдвигается и не получает отдельную рамку
внутри общей сетки.

`share-ui/SectionList` задаёт общую плитку, заголовок и разделители между строками
оружия, базовых атак и кругов заклинаний. `embedded` используется для категорий
способностей и типов действий внутри существующих плиток. Разделители работают
на корнях слотов, включая обёртки `RowActionMenu`, а не на вложенных карточках.
`footer` содержит добавление оружия до отдельной группы базовых атак;
`listAttrs` передаёт атрибуты сортировки, `transitionName` сохраняет анимацию
строк заклинаний. Табличный вариант оружия передаётся через `body`.
Предметное содержимое строк, меню, права и броски остаются в DnD-компонентах.

Заголовок `MorphTile` не задаёт нижний отступ. Расстояние у характеристик
сохраняется через верхний padding блока значения. Малые плитки КД, инициативы,
скорости и бонуса умения включают `compactHeader`; их содержимое помещается
в строку сетки высотой 64px.

Плитки редактирования листа используют `MorphTile`; общие faces для статов,
ресурсов, защит, действий, владений, денег, статусов, истощения, счётчиков и
заданий используют его `embedded`-представление с тем же заголовком. HP, уровень
и предметная строка оружия могут оставаться без заголовка. Параметры магии и
ячейки используют заголовок `MorphTile` напрямую. `TileAccentStrip` заменяет
бывший prop `BaseTile.strip` в листе, morph-превью, правилах и NPC боя.

Общие представления сами владеют единственной поверхностью `MorphTile`: это
действия, характеристики, малые статы, защиты, ресурсы, владения, деньги, сводка
статусов, истощение, счётчики, задания, HP и уровень. Контроллеры не оборачивают
их второй плиткой; morph-origin берётся с корневого `$el` представления.
В раскрытом редакторе `panel` (у характеристик `mode="panel"`) переключает
представление в `embedded`. Полоса вставляется через слот `decoration`.
Контейнеры коллекций и самостоятельные компактные варианты сохраняются.

`CampaignBadge` остаётся обычным `BaseTile`: иконка `ScrollText`, как в боковом меню,
и название сессии в одной строке с выравниванием по центру,
две `ActionButton iconOnly quiet` рядом слева следующего ряда. `CharacterTransferDialogs`
открывает игроков/события в `BasePopover`; отправка выбирает получателя
в `RowActionSubmenu` через `ItemTransferAction` с иконками 48 px;
общая начинка находится в `CharacterTransferContent`.

`CharacterReadOnlyNotice` объясняет права просмотра наверху центральной колонки
и мобильных вкладок. `CloneCharacterAction` переиспользуется обоими меню;
права и исходный UUID берутся из `charCtx`, действие выполняется через API.

Меню листа персонажа использует `CharacterMenuPopover` поверх общего
`BasePopover`: локальная часть ограничивает размер содержимого и управляет
фокусом, общая библиотека отвечает за портал, позиционирование и закрытие.
Выбор редакции использует `ActionMenuItem`, `AppModalFrame`, `ConfirmDialog`
и общие эмблемы систем, без отдельного набора базовых контролов.

## Связанные страницы

[Оглавление wiki](../README.md) · [API: персонажи](../api/characters.md) · [БД: персонажи и инвентарь](../database/characters.md) · [Обучение листу персонажа и сессии](tutorials.md)
