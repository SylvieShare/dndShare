# Общие исходники оформления

[tokens.json](tokens.json) — источник продуктовых размеров, отступов, радиусов,
типографических ролей, порогов окна и трёх фиолетовых акцентов. Размеры layout,
spacing, radius, collection, list и canvas интерпретируются как CSS px / Android dp,
размеры текста и tracking — CSS px / Android sp. Android сохраняет системный
масштаб шрифта. Motion задаёт длительности целыми миллисекундами;
исключение — distance в CSS px / dp. Семейства ролей: `ui`, `display`, `prose`.

Нейтральная палитра и общие веб-примитивы принадлежат установленному share-ui.
Доменные цвета остаются в product theme; игровые модели не входят в токены.
Переопределения размеров используют публичные CSS-токены share-ui. Изменение
API примитивов выполняется через [процесс библиотеки](../md/frontend/share-ui.md).

## Изменение

Из корня репозитория:

```bash
python3 scripts/design/tokens.py
python3 scripts/design/tokens.py --check
python3 scripts/native/sync_web_design.py
python3 scripts/native/sync_web_design.py --check
```

Генератор валидирует схему, порядок порогов, границы значений и диапазоны шрифтов.
Производные CSS, JS и Kotlin коммитятся вместе с JSON; вручную их не редактируют.
[generated.json](generated.json) хранит хеши исходника и выходов. `check:design`
в `npm test`/build отвергает рассогласование без зависимости от Python.

`frontend/src/app/design-tokens.css` содержит переменные и правила ширины,
импортируется из product `theme.css`, включая отдельные тестовые страницы;
`design-tokens.js` — численные значения и media queries для JS/PostCSS;
`native/androidApp/.../ui/designsystem/DesignTokens.kt` — типизированные dp/sp и роли Compose.
CSS использует `@media (--ui-phone)`, `(--ui-tablet)`, `(--ui-compact)`,
`(--ui-desktop)` и `(--ui-from-tablet)`: локальный PostCSS-плагин подставляет
пороги из того же источника. CSS custom properties не подставляются в media query.

Роли input/number/toggle/checkbox/slider и compact-navigation задают общий вид веб-контролов и их нативной реализации. Default canvas ровный, сюжетный grid включается явно.

Роль Header едина для шапок приложения, справочника, листа и сессии: 16/21.
Отдельной роли для пути коллекции нет; открытие коллекции не меняет размер
названия раздела.

Подключённые потребители: оболочка приложения, шапка, переходы справочника, строки списков, сетка и плитки коллекций,
общие Android-примитивы. Остальной UI переносится по одному законченному участку
сразу в обоих клиентах. Наличие токена не означает завершения переноса всех экранов.

## Шрифты и иконки

TTF и лицензии в Android закреплены в
[font-sources.json](../native/androidApp/font-sources.json). Из тех же TTF
получаются локальные WOFF2 веба с полным набором символов и variable axes:

```bash
python3 scripts/design/fonts.py --check
```

Проверка не требует FontTools. Для генерации требуется отдельное Python-окружение
с `scripts/design/requirements-fonts.lock`, затем `fonts.py --generate`.
Манифест `frontend/public/static/fonts/manifest.json` фиксирует источники,
рецепт, лицензии и SHA-256. Имена WOFF2 содержат хеш содержимого для immutable
кеша; CSS подключает их локально. Генерация не скачивает шрифты.
Lucide и нативную палитру обновляет `sync_web_design.py` из закреплённых
зависимостей веба и продуктовых токенов.

## Договорённости о различиях

[visual-exceptions.json](visual-exceptions.json) изначально пуст. Новое исключение
добавляется после явного согласования с пользователем, вместе с реализацией.
Первый набор поддерживает `feature: handbook`; `difference` описывается по-русски.
Каждая запись содержит уникальный `id`, `feature`, непустые `formats`
(`phone`, `tablet`, `wide`), `states` (`collections`, `menu`, `list`, `record`),
`difference`, `reason` и `approval`: имя в `by`, ссылку или прямую цитату решения
в `reference`, дату `YYYY-MM-DD` в `date`. При расширении набора экранов
расширяется и контракт состояний. Реестр фиксирует конкретную границу различия,
а не разрешает произвольные расхождения всего экрана.

Инструмент проверяет структуру записи и показывает её в отчёте; человеческое
согласование он не устанавливает. Отличия растеризации, системных панелей,
клавиатуры и доступности учитываются при проверке нативного поведения.

[Адаптивный дизайн](../md/frontend/responsive-design.md) ·
[UI-процесс](../md/frontend/ui-workflow.md)

Группа `chrome` задаёт размытие, прозрачность затемнения и хвост затухания шапки.
Затемнение безразмерно, размеры генерируются в CSS px/Android dp.
