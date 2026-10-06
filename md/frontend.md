# Frontend: архитектура и разработка

Границы Vue-приложения, локальная разработка и правила изменения контрактов. Навигация, общие компоненты и предметные композиции описаны на отдельных страницах.

## Разделы

| Страница | Содержание |
| --- | --- |
| [Общие UI-компоненты](frontend/components.md) | Основной каталог выбора стандартного компонента и граница между share-ui и предметной композицией DnD Share. |
| [Навигация приложения](frontend/navigation.md) | Меню, главная, маскоты, игровые системы и маршруты Vue Router. |
| [Общие frontend-взаимодействия](frontend/interactions.md) | Drag-and-drop, rich content, загрузка, обучение, уведомления и общие оптимизации списков. |
| [Сопровождение share-ui](frontend/share-ui.md) | Разрешённый межрепозиторный workflow и обновление фиксированного release tag. |
| [Компоненты справочника и создания](frontend/catalogue-components.md) | Предметные редакторы, связанные записи и общие композиции выбора расы и происхождения. |

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
- `@sylvieshare/share-ui` — общие для DnD Share, HavenShare и TrenchShare
  theme-токены, UI-примитивы и headless interactions. Пакет подключается одним
  публичным import API без deep imports.
- `src/shared/api` — общие HTTP-клиенты. `http.js` основан на `fetch`; любой
  non-2xx ответ является ошибкой.
- `src/shared/ui` — переиспользуемые компоненты уровня DnD Share. Компонент
  остаётся здесь, если знает о router, Pinia, HTTP API или доменной модели.
- `src/shared/composables` — поведение, не привязанное к одной фиче.
- `src/stores` — Pinia-кэши и глобальное состояние.

Новый или изменяемый Vue-компонент пишется через `<script setup>`. Правила
композиции вынесены в [Composition API](composition-api.md).

## CSS

Общая палитра и canvas приходят из `@sylvieshare/share-ui/styles.css`, который
импортируется один раз в `main.js`. `src/app/theme.css` задаёт DnD-акцент,
layout, доменные цвета и продуктовые prose/mono/print font stacks. Cormorant
Garamond и Literata подключаются как variable web fonts; display-роль не
запрашивает веса выше поддерживаемого `700`. `npm run check:colors` входит в production build и
запрещает новые прямые hex/RGB/HSL значения. Подробности — [CSS-токены](css-variables.md).

## Политика изменений контракта

Runtime поддерживает только текущий контракт. Если изменение ломает старый
формат, нужно:

1. добавить идемпотентное исправление данных в подходящий
   `internal/store/schema/*.sql`;
2. переключить все producer/consumer на новый формат;
3. удалить старые поля, ветки чтения, aliases и временные admin jobs;
4. обновить `md/` и тесты.

Сохранение двух форматов «на всякий случай» не допускается.

## Производительность и владение общим UI

В исходниках router и `defineAsyncComponent` сохраняют динамические импорты,
но production Vite отключает разделение JavaScript (`codeSplitting: false`)
и CSS (`cssCodeSplit: false`). Вся сборка загружается сразу одним JS и одним
CSS с хэшами содержимого, включая страницы, редакторы, галерею UI, Three.js и Meshopt-декодер.
Переходы и открытие компонентов не запрашивают дополнительные чанки: после
deploy открытая вкладка продолжает использовать уже загруженный код.
Первичная загрузка больше, чем при разделении страниц. `npm run build`
проверяет, что JS/CSS файлов ровно по одному, весь код входит в начальную
загрузку, а gzip-размер JS + CSS не превышает 1260000 Б. Не увеличивать
бюджет вместо разбора регрессии. Методика и измерения —
[frontend performance](frontend-performance.md).

Предпросмотр параметров моделей карт добавляет к общему frontend около 7 КиБ gzip. GLB-загрузчик и Three.js повторно
используются из редактора карты; OrbitControls и дополнительные runtime chunks
не добавляются. Лимит полного начального bundle — 1 260 000 байт gzip.

## Связанные страницы

[Оглавление wiki](README.md) · [Общие UI-компоненты](frontend/components.md) · [Сопровождение share-ui](frontend/share-ui.md) · [CSS variables](css-variables.md) · [Composition API Rules](composition-api.md) · [Производительность frontend](frontend-performance.md)
