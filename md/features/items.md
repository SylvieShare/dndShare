# Справочные записи: UI и схемы

Редактирование и отображение справочных объектов, стоимость, вес и предметные карточки. Правила изображений вынесены в отдельное руководство.

## Содержание

- [Скрытые записи](#скрытые-записи)
- [Editing](#editing)
- [Detail components](#detail-components)
- [Общая стоимость](#общая-стоимость)
- [Pure rules](#pure-rules)
- [Visual conventions](#visual-conventions)
- [Species presentation](#species-presentation)

## Скрытые записи

У любого item есть отдельный флаг `hidden` (по умолчанию `false`). Переключатель
«Скрытая запись» находится в общем редакторе; права совпадают с правами редактирования
записи. Скрытые записи исключены из списков, поиска, списка дочерних записей и
выбора при создании персонажа. По ID они доступны, поэтому существующие листы
и прямые ссылки продолжают работать. Для возврата записи откройте её по прямой
ссылке и снимите флаг. HTTP и MCP принимают `hidden` при создании/обновлении;
отсутствующее поле при обновлении сохраняет прежнее значение.

`frontend/src/features/items` contains item list/detail presentation and pure
rules helpers. Handbook navigation/data ownership is described in
[handbook](handbook.md).

## Editing

`ItemSourcePicker` is shared by the item editor and character source settings
(including the creation wizard). Its “Выбрать все” checkbox selects or clears
the whole source list, not just search results, and indicates partial selection.
Embedded mode reuses the same list inside an existing settings dialog.

`ItemEditModal.vue` renders `item_type.fields`. Supported field renderers
include scalar text/number/bool, description, suggest/suggest arrays, system dice,
`int_by_suggest`, object/object arrays and nested blocks. It uses shared form,
modal, select and rich-description components.

`int_by_suggest` has one stored shape: `{value,suggest_id}`. Formatting is
centralized in `lib/useCostFormatter.js`; numbers and strings are not accepted
as alternate cost formats.

## Detail components

Specialized details exist for weapons, spells, enemies, potions, feats, armor,
transport and status effects. Their data, UI and art contracts are documented in
[weapons](weapons.md), [armor](armor.md) and
[transport](transport.md).
They receive the same current `item.data` that the editor writes. Generic item
detail handles remaining schema fields.

Canonical examples:

- weapon attacks: `attacks:[{count,dice_id,type}]`;
- spell damage/heal dice: `{dices:[{count,dice_id,type,bonus?}]}`;
- spell class ownership: `classes:[{id}]`;
- feat description/prerequisites/choices: `description`,
  `prerequisite_groups`, `choices`;
- potion rarity is a suggest id and cost is `int_by_suggest`.
- equipment packs use `equipment_category:"pack"` and
  `contents:[{item_id,count}]`; generic item detail renders those referenced
  items immediately after the description and opens each through
  `ItemViewModal`.

`dice_id` is a system-die string (`"d4"`, `"d6"`, `"d8"`, `"d10"`, `"d12"`,
`"d20"` or `"d100"`). Schema fields use `type:"dice"`; there is no dice
suggest catalogue.

Feature code does not try alternative keys such as weapon `add_attacks`, spell
`dice_suggest_id`, feat `desc` or spell `classIds`. Startup migrations fix item
rows before they can be read.

Character-added weapon attack rows use `{count,dice_id,type_suggest_id}`. The
weapon calculation composable adapts those rows explicitly when combining them
with handbook attack rows; it is not a historical-format fallback.

## Общая стоимость

Все записи со стоимостью используют один `data.cost`: необязательная точная цена
`value`, необязательный диапазон `min`/`max` и общая валюта `suggest_id` из словаря
17. Точную цену и диапазон можно задавать независимо или одновременно. Например,
`{value:250,min:101,max:500,suggest_id:3}` отображается как «250 зм · диапазон
101–500 зм». У «Меча мести» задан только диапазон 101–500 зм; цена и источник
не дублируются текстом в описании.

`ItemCostEditor` — общее поле каталожного и общего редактора. Переключатель
диапазона добавляет/удаляет только границы, сохраняя точную цену и валюту.
Отрицательные числа, неполный или перевёрнутый диапазон и отсутствие валюты
блокируют сохранение. `useCostFormatter` использует общий `formatItemCost` во
всех строках, подсказках и карточках. Стартовый магазин использует только точную
цену: диапазон не становится бесплатной покупкой или ценой по нижней границе.

### Иконки валют

Денежный словарь 17 использует пять отдельных прозрачных lossless WebP
`128×128`: медь (id 1, квадратное отверстие), серебро (id 2, полумесяц),
золото (id 3, солнце), электрум (id 4, восьмиугольник со звездой) и платина
(id 5, шестиугольник с алмазом). Исходные SVG проверены визуально: это кольца
с буквами, растровых исходников у монет не было. Промпты и итоговые хеши:
`md/data/currency-icons.json`.

Растровая иконка саджеста хранится только как `suggest.icon_image_id`,
ссылающийся на общий `storage_image`. API проецирует `iconImageId` и
`iconImageUrl` через JOIN, без отдельного URL в саджесте. `ItemIcon` отдаёт
приоритет картинке перед SVG и не перекрашивает её. Словарь, общие picker,
поиск и денежный блок используют один контракт; кошелёк показывает иконку
24 px, его выбор валюты — 24 px.

Установка системной иконки идёт через MCP
`handbook_suggest_set_system_image(typeId,id,fileName,mimeType,dataBase64,
preservePrevious)`, с `preservePrevious=true` при замене. PNG/WebP до 5 MB
публикуются в S3 под `system-item-media/v1/suggests/{typeId}/{id}/icon/{sha256}`.
Старый SVG остаётся самостоятельной иконкой с меньшим приоритетом. Бинарники
не коммитятся и не загружаются при старте приложения.

## Pure rules

Обычные предметы (тип 2) имеют необязательное поле `purchase_quantity`
«Количество в упаковке»: положительное целое число, по умолчанию 1.
`cost` и `weight` относятся к этому количеству, а количество экземпляра в
рюкзаке — к отдельным штукам. Например, упаковка из 20 стрел стоит 1 зм и
весит 1 фунт; стопка из 13 стрел имеет стоимость 0,65 зм и вес 0,65 фунта.
Справочные карточки, списки и подсказки подписывают цену/вес «за 20 шт.»;
подсказки инвентаря персонажа и сессии показывают значения всей стопки.
`lib/itemPackaging.js` задаёт общий расчёт; явные `override.cost/weight`
относятся к одной штуке. Учёт длины через `length_ft` и удельные значения
сохраняет свой отдельный расчёт.

`lib/featRules.js` evaluates structured feat prerequisites, grants and choices.
It reads only current keys. Unit tests cover requirement groups, repeatable
entries and selected choices.

Feats use explicit `data.category`: `origin` («Черта происхождения»),
`general` («Универсальная черта»), `epic_boon` («Эпический дар») and
`fighting_style` («Боевой стиль»). `lib/featCategory.js` supplies the shared
labels for list rows, reference rows, details and eligibility messages. The
category is editable and available as a handbook filter. An uncategorized 2014
or custom feat receives no inferred category. Origin feats in the creation
wizard reuse `FeatListItem` and open the standard reference modal.

## Visual conventions

- descriptions render through `RichContent`; embedded `dice` nodes may store an
  optional manually entered numeric `average`, rendered inside the roll chip
  before the formula and retained when the node is edited;
- startup migration recursively replaces imported dice widgets and legacy
  tooltips in every item description: resolvable handbook entities become
  `item`/`suggest` nodes, while unresolved source references remain usable as
  native links;
- base PHB weapons, ordinary equipment, feats and race/class abilities receive
  idempotent `item.svg` icons from startup schema; related class mechanics may
  share semantic artwork, while every item still has an explicit
  `icon_svg_id`;
- `ItemIcon.vue` prefers the item's `iconImageUrl`, then its SVG, and finally
  falls back to the item type's `iconImageUrl`. Raster item icons are PNG/WebP
  objects registered through `storage_image` and stored in S3; collection
  emblems use the same projection contract but point to transparent PNG assets
  embedded under `public/static/handbook-types`;
  Handbook lists/pickers, the global header search, detail presentations and
  modal titles use the same rule instead of inferring art from localized names;
- all handbook object rows share `ObjectListItem.vue`: a 64 px icon well is pinned to
  the left edge, followed by an optional metric such as spell level or monster
  CR, a two-line identity block and trailing metadata. Raster artwork fills the
  icon well on desktop and mobile; compact SVG, collection-emblem, potion-vial and feat-sigil
  fallbacks stay centered in the same geometry;
- handbook search, schema filters and publication-source filters live in the
  fixed control area at the top of the list column, above its independently
  scrolling rows. Text search matches a case-insensitive substring of either
  the Russian name or `nameEn`; publication codes remain in the dedicated
  source filter. Its publications are grouped as core books, official
  supplements, settings, adventures, Unearthed Arcana and third-party
  material; PHB, MM and DMG keep that canonical order inside the core group.
  The main catalogue and item pickers reuse this placement.
  Bestiary schema filters cover creature type, size, environment, legendary
  status, named-NPC status and CR; the finite CR list is stored in schema
  metadata so the filter control is available before any dictionary request.
  Spell filters include the base class items referenced by `classes[].id`.
  Effects offer «Базовые эффекты», «Магические предметы» and «Заклинания»
  in the source-of-effect filter. Basic effects are the 14 standard conditions,
  exhaustion and inspiration; the other groups come from visible type-19/type-5
  `status_effects` links. Groups can overlap and multiple selections are combined
  with OR. With no selection, all effects remain visible, including ability effects;
- on screens up to `760px`, the item picker uses a mobile list-to-detail flow:
  selecting a row replaces the list with the full detail, while an explicit
  `К списку` action or a right swipe returns to the results. Type tabs are
  hidden in detail view, and the quantity/confirmation footer remains fixed;
- when quantity selection is enabled, the picker confirmation button reserves
  a fixed width for `+ Добавить ×999` on desktop and mobile. Changing the count
  does not resize the button or shift the adjacent quantity controls;
- details open through the handbook `ItemViewModal`/modal stack; `ItemViewModal`
  uses the lower-level `AppModal` because the shared item header is its only
  header, and forwards an optional action slot into a fixed footer, so
  character-specific mutations do not leak into handbook detail renderers;
- every item detail uses `ItemDetailHeader.vue`. It renders a panoramic item
  `coverImageUrl` as full-bleed artwork behind the identity block and actions,
  falling back to the item type's `coverImageUrl`. Every built-in item type owns
  that fallback, so the header always uses cover geometry and never substitutes
  the compact icon. A missing or failed image keeps the same type profile over
  the neutral header background instead of switching layouts. While a new cover
  loads and decodes, the previous artwork is hidden and a centered loading
  indicator appears over that background; it stops on success or error. The technical item ID is
  rendered as muted metadata at the bottom of the detail content, never on the
  artwork. Cover height is a per-handbook-type presentation profile without a
  shared maximum: the default follows the asset's intrinsic ratio, while a type
  may opt into a minimum height without branching the header;
- spell details use a `300px` minimum `5:2` profile. Level and
  school form a compact vertical identity block below the title. A compact
  component card is aligned to the right above the three-column row with
  casting time, range and duration. These short values are omitted from the
  content below, while the
  full material-component description remains there. The spell item type owns
  a `5:2` fallback cover, and a failed image does not restore the former
  duplicate metadata layout;
- bestiary details use a `440px` minimum cover profile. Their identity, source,
  tags, CR/AC/HP/proficiency, speeds and all six ability modifiers are rendered
  in the header summary slot. The cover itself is not dimmed: the title uses a
  compact content-sized scrim and each metadata/stat group owns its translucent
  block. On desktop CR/AC anchor the left edge, HP/proficiency/speeds anchor the
  right edge, a reserved center column exposes the creature, and abilities form
  the bottom strip. At `520px` and below the side groups become two columns and
  abilities use a `3×2` grid. Skills and all later sections remain below the
  artwork;
- weapon details use a `420px` minimum `4:3` cover profile. Damage/category
  tiles anchor the left edge, range/cost/weight tiles anchor the right edge,
  and a bottom translucent rail shows OR-proficiencies and properties. The
  weapon image remains visible in the reserved center column;
- transport details use a `400px` minimum `3:2` cover profile. Category and
  primary movement sit on the left, cost and weight on the right, and the
  movement/capacity/relation rail stays at the bottom. Mount icons are compact
  head portraits facing right; object and vehicle icons use their own full
  silhouette. The full contract is in [transport](transport.md);
- all ordinary type-2 gear uses a portrait item-showcase contract. The type owns
  a fallback cover and an item-level cover may replace it. The source cover is an opaque
  `1536×1024` JPEG (`3:2`) and fills a `400px` minimum header. Price and weight
  are real translucent UI cards at the quiet lower left and right of the cover
  when present and are not baked into the illustration or repeated below it.
  Measured gear derives both cards from the item type's default instance value
  and its `unit_cost_data_key`/`unit_weight_data_key`: the handbook therefore
  shows the price and weight "за 50 фт." for rope while the shared item still
  carries no concrete length;
- cover overlays reuse `components/cover/CoverStatCard.vue`,
  `CoverSummaryLayout.vue`, `CoverSummaryRail.vue` and
  `CoverSummaryRailItem.vue`. Domain summaries keep their own data mapping but
  do not duplicate the frosted surface, side/center grid or segmented rail CSS.
  A stat or rail icon is a larger translucent right-centered introductory mark
  rather than a small glyph prepended to the label; shared padding reserves its
  space on desktop and mobile;
- status-effect details use a compact `320px` minimum `4:1` dashboard. The
  effect icon appears in the reserved centre only when no cover is displayed
  (including a failed image load); item and type covers both hide it. Polarity, duration, stacking,
  concentration and the number of structured rules remain readable around it.
  Content below the cover renders thesis bullets, description, derived bonuses
  and defenses as labelled rule cards instead of exposing schema keys. The
  canonical six exhaustion penalties are shown as a numbered level track;
- field labels and errors use shared form components;
- direct color literals are rejected by `npm run check:colors`.

## Species presentation

Race/subrace records expose `creature_type` and `size_description` as editable
text fields. Creature type appears in the cover summary; size/height notes appear
in the detail content and beside creation choices. Species `variants` also
support `benefits: [{text}]`, `size_description` and rich `description`.
These fields explain options without inventing additional automation.

PHB 2024 species/subspecies have 60 separate type-3 ability records, bound through
`race_ids` and, for lineage-specific grants, `subrace_ids`, with explicit acquisition levels. The shared `RaceAbilityList` is
used below the selected creation cover and in race/subrace handbook details.
Each tile opens the normal handbook modal. Previous aggregate abilities are
hidden from new selection but retain their IDs and mechanics for existing
character references. Species lore no longer duplicates the ability rules or
the creature type, size and speed metadata.

Drow, High Elf and Wood Elf (2024) are separate type-16 handbook records. Their
icons and covers use the ordinary item media fields independently of the base
race and the 2014 records. Each description contains its own lore; ability
descriptions contain only the selected lineage’s benefits. The matching 2024 elf and gnome subraces reuse the same icon and cover IDs
as their 2014 counterparts. Six goliath ancestries have independent paired
1536×1024 covers and transparent 128×128 bust icons. Images are assigned
through MCP; no files are duplicated for reused media.

Racial spell tiles use `RaceSpellList`/`HandbookReferenceRows`, with real spell
IDs and unlock levels read from `granted_spells`. Tiefling heritage lore and
resistance/spell rules are separate type-16/type-3 records; size is not duplicated
on each child. `choice_only` controls acquisition presentation and does not delete
a rule, saved selection, or granted spell. Dragonborn variant cards keep their
specific benefits, without repeating the common height and rules text.

The three tiefling heritage cards have independent transparent 128×128 WebP icons
and 1536×1024 JPEG covers. Abyssal uses red skin and rugged dark horns, Chthonic
lavender skin and pale crown horns, Infernal copper skin and smooth orange horns.
The base tiefling retains its own media. Prompts and publication hashes are in
`md/data/rules-editions/tiefling-media-2024.json`.
The three heritage magic abilities retain their grants but carry `choice_only`
to avoid duplicating the expanded spell list in the wizard. Spell acquisition
levels appear to the left of the tiles, including on mobile.

Dragonborn ancestry stores a suggest-12 `damage_type` and a `defenses` list.
The same damage ID drives the existing colored SVG icon and the creation grant.
The old 2024 Resistance ability is hidden from new catalogue choices.

## Связанные страницы

[Оглавление wiki](../README.md) · [Изображения справочника](../handbook-media.md) · [Редактирование справочников](catalogue-editor.md) · [БД: справочник](../database/handbook.md)
