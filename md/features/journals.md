# Дневники

Дневник отображается вертикальной лентой: новые события сверху, высота каждой
карточки определяется полным содержимым. Холста, фиксированного preview,
масштаба, авторасстановки и боковой панели подробностей нет.

## Открытие и композиция

На персонаже дневник находится во вкладке `Дневник`, рядом с заметками.
Задания — записи самого дневника; отдельный блок заданий убран из стандартных
desktop/mobile-схем. Пользовательские схемы используют тот же блок `DndDiary`.
У мастера вкладка сессии содержит тот же `JournalWorkspace` / `JournalTimeline`.
Сессионный workspace сохраняет внешние отступы от панели игроков и собственную
вертикальную прокрутку. На персонаже прокручивается обычное содержимое вкладки.

Название дневника, переключатель `Личный` / `Сессии` и горизонтальная навигация
разделов объединены в отдельную шапку на `BaseTile`. Личный дневник у персонажа один.
При первом открытии пустого дневника владельцем он создаётся автоматически с
именем `Личный дневник`, без формы и отдельной кнопки создания. Чужой просмотр
ничего не создаёт; уже выбранный источник сохраняется. Ошибку загрузки/создания
можно повторить. Переключатель источника показывается только при наличии
доступного дневника сессии: без него нет ни выбора, ни подсказки о сессии.
Видим один раздел, выбираемый горизонтальной строкой с `Новый раздел` в начале.
Над лентой — фильтр `Всё / Задания / Диалоги`; справа — добавление, правка
раздела и управление порядком. При фильтрации перестановка отключена, чтобы
невидимые записи не меняли порядок. Создание возвращает полный список.

Компактные карточки соединяет тихая центральная линия. У каждой карточки цветная
рамка по типу и отдельная шапка. Иконка стоит только слева от названия;
водяных знаков на фоне нет.
В шапке рядом находятся карандаш, информация и корзина. Карандаш открывает
единый черновик всей записи: название, описание, реплики, участники и задание.
`Сохранить` отправляет все изменения одной операцией, `Отмена` ничего не меняет.
Создание спрашивает только тип и открывает этот же редактор. Тип созданного
события неизменяем. Ошибка не удаляет черновик и допускает повтор сохранения.
Все подписи полей расположены сверху (`FormField vertical`), поля занимают
ширину содержимого карточки без дополнительной колонки слева. Реплики и
участники сгруппированы разделителями; числовые характеристики переносятся
на узком экране, не сжимая соседние поля. Пункты заданий и награда многострочные.
Общая панель сохранения отделена снизу; отступы редактора адаптируются к ширине
самой карточки, в том числе в узкой вкладке на большом экране.
Тип `header` (`Заголовок`) содержит только название и разделяет ленту.

Диалоги сохраняют цвета говорящих; на телефоне имя располагается над текстом,
чтобы не сжимать реплику между колонками. Иконки существ бестиария разрешаются
одним пакетным запросом на раздел. В карточках нет текстовых меток типов и
общих счётчиков голосов/участников. Автор и даты скрыты под иконкой информации
рядом с корзиной. Наведение, фокус или нажатие раскрывают полный аудит, включая
автора и время правки и источник из сценария. Отдельных плашек связей нет.

## Задания в ленте

Тип `quest` создаётся тем же picker, что события и диалоги. Название и описание
редактируются на месте; внутри задания остаются пункты с галочками и награда.
Каждый пункт имеет стабильный ID, текст и признак выполнения. Пункты можно
добавлять, переименовывать и удалять. Прогресс считается по пунктам, выполнение
всех непустого списка переводит отображение в `Завершено`; снятие отметки
возвращает `В работе`. Завершённая запись остаётся в истории.

Галочки, пункты и награда меняются в общем редакторе и сохраняются вместе с
остальными полями. В просмотре галочки неактивны. Черновик изолирован от исходной
записи; ошибка сохраняет его с повтором/отменой. Права одинаковы на странице
персонажа и сессии.

Каталог `session_quest` доступен через отдельную вкладку `Задания` страницы
сессии (`Alt`/`Option` + `4`) и ссылки сценария. Это не записи дневника;
оба вида заданий сохраняют свои данные и связи.
Прежние значения `DND_QUESTS` также сохранены, но не включены в стандартную
схему и не публикуются автоматически. Пользовательские схемы могут их отображать.

## Порядок и телефон

На desktop заголовок события служит ручкой drag через общий `useSortable`.
Сфокусированный заголовок также принимает стрелки вверх/вниз.
Если устройство имеет coarse pointer, drag отключён: жест на заголовке
прокручивает страницу. Кнопка порядка справа сверху раскрывает явные кнопки
поднять/опустить для каждого события; они доступны и на desktop.
Карандаши имеют увеличенные области нажатия на touch-устройствах.

Перестановка передаёт исходную и новую полные последовательности ID. Сервер
проверяет текущий порядок под блокировкой дневника и раздела; устаревшая
операция получает 409, после чего клиент обновляет ленту. Изменяются только
`journal_entry.position`, не содержимое и не авторство записей.
Polling и переключение источника/раздела приостановлены во время drag/правки.

## Данные и права

`journal_entry` по-прежнему хранит содержимое и аудит, `journal_section` —
разделы. Возврат ленты не откатывает миграции и не удаляет записи, координаты
или связи бывшего холста. `journal_node`, `journal_link` и их API сохранены
отдельно; текущий UI не показывает и не редактирует граф.
Новые записи добавляются в конец порядка раздела и показываются сверху.
Импорт из сценария сохраняет снимок источника и использует тот же формат записей.
Задание хранится в `journal_entry.payload.quest` как `{reward, objectives}`,
где пункт — `{id, text, done}`. Сервер принимает до 100 пунктов, текст пункта
до 500 символов и награду до 2000 символов; пустые тексты и повторные ID запрещены.

Удаление события/раздела требует подтверждения и удаляет только выбранное
содержимое с его узлами и связями; соседние события не удаляются.
`expectedChangedAt` защищает inline-правки содержимого от параллельной перезаписи.
DM редактирует всегда; игрок — при включённом `playersCanEdit`. Этот флажок
виден только DM в шапке дневника на странице сессии.

Контракты: [API](../api.md), [БД](../database.md),
[общая frontend-архитектура](../frontend.md).

## Дневник внутри листа персонажа

The `Дневник` sheet tab contains the shared `JournalWorkspace` (including quest
entries) and notes. The separate quests block is no longer in the default layouts;
its existing values are preserved for custom schemas.
Both desktop and mobile use the same vertical `JournalTimeline`; there is no
separate journal window or canvas. Custom diary blocks render this workspace too.
Entries remain in journal tables rather than character JSON.

The source switch (`Личный` / `Сессии`) appears in the header only when a session
journal is available. Without one there is no source selector or campaign hint.
The owner's first visit initializes a missing personal journal automatically,
without asking for a name; an existing selected journal is left untouched.
Each character has at most one personal journal.
Horizontal section tabs show one section at a time. Full event cards grow with
their contents, newest first, with a connecting line through their centers.
Creation and section/order controls sit at the top right of the event area.
There is no zoom, layout action, or detail side panel. Filters sit above the list.

Creation asks only for a type, then opens a whole-entry draft. One header pencil
edits all fields, dialogue lines, combatants and quest objectives. Save is atomic,
cancel leaves the original untouched, and existing types are immutable.
The header-only entry type is available for titled separators. Every card uses
a type-colored frame and an icon beside the title, without a background watermark.
Dialogue voices retain scenario colors and stack speaker above text on mobile.
Battle rows use handbook artwork with a single batched lookup per section.
Source and audit are hidden behind an information icon beside edit/delete in the header.

Desktop events can be dragged by their header or moved with keyboard arrows.
On touch-capable devices headers permit native vertical scrolling; the order
control reveals explicit up/down buttons instead. Reordering sends both the
expected and desired ID order, and stale/concurrent moves return 409.
It does not rewrite content, authorship, or the graph stored by the former canvas.
That graph is preserved in the database but is not drawn or edited by the UI.

Inline drafts keep save/cancel controls and remain on failure; content saves
require `expectedChangedAt`. Polling and source/section navigation pause during
editing and dragging. The DM always edits; players require `playersCanEdit`.
Only the DM's session-page header shows that setting. See [Journals](journals.md).

## Связанные страницы

[Оглавление wiki](../README.md)
