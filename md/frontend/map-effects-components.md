# Компоненты пламени и runtime редактора

Статус: действующий контракт.

## Пламя источника света

MapLightEffectFields составляет настройки пламени из ToggleSwitch, FormField
и AppSlider, используется в фокусе света и внутри MapModelLightTemplate.
Цвет и включение редактируются существующими MapLightActions. MapLightFields
и MapModelLightTemplate используют общие преобразования высоты основания и
смещения света из lightEffect; парная правка записывается одним шагом Undo. Общие параметры
экземпляра проходят через editorLighting; отдельной сущности эффекта нет.
Контракт — [пламя источника](../features/maps-light-effects.md).

MapSelectionPanel использует navigation-slot общего WorkspaceFocusPanel для
MapFocusBack: стрелка, иконка типа и актуальное имя родителя. useMapFocusHistory
хранит до 50 снимков идентификаторов, записывает только переходы по ссылкам из
инспектора, восстанавливает выделение и пропускает удалённых родителей. Прямое
выделение очищает стек; состояние не сериализуется.
MapModelTransitions показывает переходы каталога и экземпляра. MapTileTransitionPicker
переиспользует MapTilePalette в режиме select с локальным выбором коллекции;
текущая модель и уже выбранные кастомные цели исключены. Карточки появляются и
удаляются плавно, reduced motion отключает движение.

MapEntityRow и MapEntityHeading сохраняют showIdentifiers, по умолчанию false;
MapCatalogueCard также скрывают коды в обычных карточках, заголовках
групп и tooltip. MapTilePalette/MapObjectPalette включают идентификаторы только
в режиме inspect админского справочника. Данные модели не преобразуются.
MapModelTransitions использует ту же MapEntityRow для всех переходов: details-slot
содержит ArrowRight и italic-действие, нажатие строки применяет переход. Пустая
строка открывает выбор; у кастомной цели есть только корзина в actions-slot внутри
строки справа. Click и keydown корзины не передаются карточке/горячим клавишам.
displayedTransitions фильтрует текущую модель и выбирает одну связь к цели
(кастомная → каталог → возврат), не меняя instanceTransitions или документ.
Недопустимая цель задаёт disabled/aria-disabled строки и объяснение причины.

createModelTransitions в renderer хранит только визуальную историю modelId тайлов.
Смена модели ожидает modelVisual (LOD/render), затем использует createScalarMotion
и существующий shader flash applyAreaOpacity в течение 480 мс. Пока импульс активен,
tileGroup выделяет экземпляр в отдельный instanced bucket; после завершения
onSettled пересобирает обычную группу. Поэтому вспышка не переходит на соседние
экземпляры и не оставляет лишние draw calls. createMapFrameLoop ведёт импульс
вместе с областями. Snapshot/reduced motion сразу возвращают нормальную яркость.

MapModelCatalogue — общая композиция каталогов тайлов, объектов, декалей и выбора
цели перехода. Для моделей modelGroups создаёт разделы по code с хранимым русским
groupName; декали передают готовые группы категорий через groups.
Варианты идут обычными соседними MapCatalogueCard, сортируются по variantCode и ID;
раскрытия карточки и отдельного списка вариантов нет. Для стен раздел включает
подзаголовки структурных форм. MapEntityHeading показывает MapPackIcon рядом
с названием модели. Технические коды видны только в режиме админского inspect;
английские названия редактируются в справочнике.

## Runtime редактора карт

MapEditor собирает публичный интерфейс ядра и workspace-действий один раз,
без последующей подмены handle/removeSelected. useMapEditor связывает контроллеры;
useEditorSelection хранит выделение, useEditorJournal — патчи Undo/Redo,
useMapPersistence — autosave и серверную ревизию. documentIndex предоставляет
индексы и контекст размещения вместо повторного поиска каждой выбранной записи.
MapCanvas группирует события указателя по RAF и разделяет причины обновлений.
Наведение идёт через sceneSelection, полная синхронизация — через sceneSynchronizer.
modelBatches общий для плиток и объектов; sceneObjectLayer сохраняет логические
корни для привязок и выделения при пакетной GPU-отрисовке.
assetView управляет видимыми чанками и запасом, modelResidency — бюджетом
неактивного кеша. modelPicking строит общий BVH в отдельном worker.
renderPass восстанавливает состояние GPU для обводки, тумана и превью области.
sceneFrame владеет общим MSAA-кадром: после вывода цвета маска выделения
использует его исходную глубину без повторного прохода окружения. Туман работает
с тем же буфером в HDR-режиме; outlinePasses хранит только готовый край участка.
Контракт display target для закреплённого Three и сохранение MSAA при resize/
восстановлении WebGL изолированы в sceneFrame. GPU resolve учитывается в
«Выводе кадра», а не приписывается последней модели или служебной метке.
Контракты — [нагрузка карт](../features/maps-performance.md),
[освещение](../features/maps-lighting.md). Базовые UI-примитивы остаются в share-ui.

MapLibraryEntry — единый вид карты плиткой или строкой для «Мои», «Подписки» и
«Каталог». Он компонует BaseTile и MapThumbnail, а MapRating использует общий
share-ui/StarRating. Права, запросы, статистика и публикация остаются в
useMapLibrary; StarRating содержит только представление и клавиатуру.
MapPublishedView показывает опубликованную заготовку без редакторских контролов.


`WorkspaceControlsHint.vue` — единая сворачиваемая легенда редактора карт,
«Мира» и сюжета: BaseTile/ActionButton, анимация размера и прозрачности,
клавиатурный возврат фокуса, reduced motion, подписи через props и slot действий.
MapControlsHint и CanvasHotkeyHints — адаптеры текста и safe-area, собственной
геометрии/стилей легенды у них нет. Легенда сюжета не зависит от глобальных
подсказок клавиш; SessionShortcutHelp расположен в SessionSettingsWorkspace.

`MapDecalPalette` показывает все группы одновременно через MapModelCatalogue;
плитки, объекты и декали используют один MapCatalogueCard на BaseTile,
с общим фоном map-model-preview-bg, размерами превью и поведением переноса.
Загрузка доступна через ActionButton, все личные изображения находятся только
в группе «Свои», общего списка размещений в каталоге нет; `MapDecalFields` использует FormField, FormTextInput
и AppSlider внутри MapInspectorSection. Наложение и локальная привязка к 3D-модели
— предметный слой [декалей](../features/maps-decals.md).

`MapModelDecals` показывает существующие наложения модели строками MapEntityRow
в MapInspectorSection, с переходом и удалением на ActionButton. Переименование
декали использует общий InspectorHeading/InlineEdit. MapPickupPing — предметная
обратная связь холста при срабатывании удержания (с учётом reduced motion);
[декали](../features/maps-decals.md) используют общий проход обводки с альфа-маской.

MapLoadingErrorDialog — доменное содержимое общего AppModalFrame: ошибки загрузки
с этапом, моделью и затронутыми экземплярами. Собственной модальной оболочки нет;
MapCanvas использует useMapLoadingErrors и общий менеджер ресурсов. Ошибки фонового
удаления слепка используют существующий AppNotifications(type=error).

Камеры карт используют общий `MapSelectedEntity`: единые `MapEntityHeading`,
`InspectorPreview`, переименование и красная корзина. `MapCameraFocus` добавляет
только превью камеры и ползунки Z/ширины на `AppSlider`; отдельной шапки и полей
координат у камеры нет.

SessionMapCreatures переиспользует useCatalogueDrag с порогом 5 px и callback
клика: pointer capture, превью, подтверждение и отмена общие с каталогом моделей.
MapEntityRow(placed) использует BaseTile(framed, frameWidth=2) из share-ui 0.40.0
и фиолетовый accent для наличия жетона на карте; selected продолжает обозначать
текущий фокус. activateOnClick=false оставляет pointer-клик контроллеру порога,
а Enter/Space — обычному действию строки. Плюс в строке убран. sessionTokens
передаёт реальную surface-позицию в общий плавный focusAt после раскрытия инспектора.

## Связанные страницы

[Каталог компонентов](components.md)
