# Frontend

Актуальная реализация — Vue 3, Composition API, Pinia, vue-router и Vite 8 в
`frontend/`. Старого Vue CLI, webpack, Axios и серверных JSON-шаблонов листа в
проекте нет.

## Запуск и проверка

```bash
cd frontend
npm install
npm run dev
npm test -- --run
npm run build
```

Vite работает на `:5173` и проксирует `/api` и `/mcp` в Go-приложение на
`:8080`. Production-сборка попадает в `frontend/target/dist`; Go-бэкенд вшивает
её в бинарь. Для неизвестного клиентского пути Go возвращает `index.html`, а
`/api/**` и `/mcp` никогда не попадают в SPA fallback.

## Границы кода

- `src/app` — router, тема и корневая композиция.
- `src/features/<feature>` — страницы, компоненты, composables и API конкретной
  предметной области.
- `src/shared/api` — общие HTTP-клиенты. `http.js` основан на `fetch`; любой
  non-2xx ответ является ошибкой.
- `src/shared/ui` — обязательные переиспользуемые UI-примитивы.
- `src/shared/ui/form` — единый набор элементов формы.
- `src/shared/composables` — поведение, не привязанное к одной фиче.
- `src/stores` — Pinia-кэши и глобальное состояние.

Новый или изменяемый Vue-компонент пишется через `<script setup>`. Правила
композиции вынесены в `md/composition-api.md`.

## Стандартные компоненты: что и когда использовать

Компоненты ниже — не локальные удобства отдельных экранов, а стандарт проекта.
Перед созданием нового оверлея, поля или drag-and-drop нужно сначала выбрать
подходящий примитив отсюда.

| Задача | Стандарт | Когда использовать |
|---|---|---|
| Базовое модальное окно | `shared/ui/AppModal.vue` | Контейнер для нового составного диалога. Даёт backdrop, Escape, focus/слои, `role=dialog`, fullscreen/tile варианты. Escape закрывает только верхнее окно стека. |
| Подтверждение | `shared/ui/ConfirmDialog.vue` | Удаление, отмена операции, сброс формы и любое решение «подтвердить/отменить». Поддерживает `loading`; не собирать собственный overlay. |
| Ввод одного текста | `shared/ui/TextPromptDialog.vue` | Создать/переименовать альбом, сцену, сущность. Заменяет `window.prompt` и локальные формы из одного input. |
| Морф-переход из элемента | `shared/ui/MorphSheet.vue` | Только когда окно должно анимированно раскрываться из конкретной плитки/кнопки. На desktop фон размывается, на mobile полноэкранный sheet оставляет фон без blur. Поля внутри не получают автофокус при открытии; фокус допустим после явного действия пользователя. Обычный диалог строится на `AppModal`. |
| Поле формы | `shared/ui/form/FormField.vue` | Label, hint и горизонтальная/вертикальная раскладка одного поля. |
| Текст/число/select/многострочный текст | `FormTextInput`, `FormNumberInput`, `FormSelect`, `FormTextarea` | Любой универсальный ввод соответствующего типа. Не вводить новые локальные классы input/select без отдельной UX-причины. |
| Кнопки формы | `shared/ui/form/FormActionButtons.vue` | Стандартная пара отмена/сохранение и loading/disabled состояния. |
| Выбор значения | `shared/ui/ValueSelect.vue`, `SuggestPicker`, `SuggestAdd`, `SuggestMultiSelect` | Обычный select либо одиночный/множественный выбор из серверного справочника; компоненты сами отвечают за desktop dropdown и mobile sheet. |
| Расширенное описание | `shared/ui/InputDescription.vue` | Редактирование форматированного описания. |
| Отображение описания | `shared/ui/RichContent.vue` | Безопасный и единообразный вывод HTML, созданного `InputDescription`. Не использовать собственный `v-html` для такого контента. |
| Popover/контекстное меню | `shared/ui/BasePopover.vue`, `RowActionMenu.vue` | Неблокирующий контент, привязанный к управляющему элементу. |
| Перетаскивание | `shared/composables/useSortable.js` | Сортировка и перенос между группами. `useSortable` ведёт drag-состояние, `reorderByDrop` выполняет чистую перестановку массива. |
| Переключатели | `MultiToggle`, `ToggleSwitch`, `EncCheckbox` | Выбор режима, boolean и компактный checkbox соответственно. |

Категории модальных окон:

- подтверждение — `ConfirmDialog`;
- один текстовый ответ — `TextPromptDialog`;
- сложная предметная форма — feature-компонент, но его оболочка всегда
  `AppModal`;
- детальная карточка справочника — `ItemViewModal`;
- раскрытие из плитки — `MorphSheet`.

`window.alert`, `window.confirm`, `window.prompt` и вручную собранные во feature-коде
`position: fixed` backdrop-оверлеи запрещены. Shared picker/reporting primitives
могут владеть специализированным sheet/highlight слоем. Ошибка поля показывается рядом с
полем; ошибка операции — в состоянии формы/экрана. Если требуется новая
повторяемая категория диалога, сначала добавляется обобщённый компонент в
`shared/ui`, затем он используется фичами.

## Мобильная шапка приложения

По умолчанию маршрут использует режим `flow`: `AppHeader` находится в обычном
потоке документа и естественно уезжает вместе со страницей без JS-наблюдения за
`window.scrollY`. Полноэкранный workspace с собственным scroll-контейнером может
явно задать `meta.mobileHeader: 'collapsible'`. Такой экран регистрирует активный
DOM `Element` через `shared/composables/useAppHeaderCollapse.js`; контроллер один
владеет scroll/touch listeners и состоянием `ui.headerHidden`. Полноэкранный
экран со своей навигацией может использовать `meta.mobileHeader: 'hidden'`:
тогда `AppHeader` не отображается на ширине до 640 px, а контент занимает всю
высоту viewport.

Feature-компоненты не должны самостоятельно слушать `window` или записывать
`headerHidden`. При смене вложенной вкладки workspace перерегистрирует её scroll
element. Для измерения внутренних toolbar передаётся явный DOM-ref; `$el`
Vue-компонента не является допустимым контрактом, потому что fragment-компонент
может вернуть text/comment anchor вместо `Element`.

## Drag-and-drop

`useSortable` — единая механика списков сцен, музыки, инвентаря и других
сортируемых коллекций. Feature-компонент отвечает только за идентификатор
группы, отображение placeholder и сохранение результата. Расчёт индексов,
pointer lifecycle и перенос массива не копируются в компонент.

Для простой перестановки после drop используется `reorderByDrop(items,
fromIndex, toIndex)`. Для нескольких контейнеров используются группы
`useSortable`; DOM-контейнер помечается `data-sortable-container`.

## Форматированные описания

Пара `InputDescription` + `RichContent` является единым контрактом расширенного
описания. В данных хранится HTML-строка текущего формата. Редактор отвечает за
создание разметки, renderer — за её показ. Не добавлять параллельные поля
`desc/description` ради совместимости: у каждой сущности в схеме должен быть
один документированный ключ.

## Персонажи и игровые системы

`features/character-editor/settings/index.js` — реестр поддерживаемых систем.
Для каждой системы он задаёт:

- schema/layout листа из кода;
- semantic accessors для имени, аватара, подзаголовка, уровня, HP, AC и
  инициативы;
- создание начального payload, если оно отличается от D&D wizard.

`char_template` хранит только `id` и `name`. Полей `schema`, `createForm` и
`pathValues` нет. Список персонажей, toolbar и сессии используют одни и те же
accessors; чтение путей из БД не допускается. D&D и VTM зарегистрированы в коде.

Канонические D&D-данные читаются только в текущем формате: `lvl` — объект,
`classes` — массив, характеристики имеют `value {base,bonuses}`, `speed` —
`{base,bonuses}`, `hp.hitDice` — массив, `spells` — объект, инвентарь —
`{equipped,sections}`, деньги — `{order,amounts}`. Преобразование старых данных
выполняет startup-схема из `internal/store/schema/*.sql` до начала
HTTP-обслуживания; компоненты не содержат read-time миграций.

## Router

Актуальные страницы: `/`, `/sessions`, `/sessions/:uuid`, `/join/:code`,
`/chars`, `/chars/new`, `/char/:uuid`, `/char/:uuid/print`, `/handbook`,
`/handbook/dictionary`, `/handbook/objects`, `/admin`. Неизвестный клиентский
маршрут перенаправляется на `/`.

Router prefetch хранится 30 секунд и используется страницами списков. Направление
перехода определяется `meta.section/depth/pageOrder`; навигационные компоненты
не должны вычислять его повторно.

## CSS

Цвета берутся из `src/app/theme.css`. `npm run check:colors` входит в production
build и запрещает новые прямые hex/RGB/HSL значения. Подробности —
`md/css-variables.md`.

## Политика изменений контракта

Runtime поддерживает только текущий контракт. Если изменение ломает старый
формат, нужно:

1. добавить идемпотентное исправление данных в подходящий
   `internal/store/schema/*.sql`;
2. переключить все producer/consumer на новый формат;
3. удалить старые поля, ветки чтения, aliases и временные admin jobs;
4. обновить `md/` и тесты.

Сохранение двух форматов «на всякий случай» не допускается.
