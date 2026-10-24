# Подготовка миниатюр существ

← [3D-модели итемов](item-models.md) · [Обработка моделей](maps-model-pipeline.md)

Миниатюра — статический GLB с PBR-материалами, без вшитой подставки.
Основание добавляется отдельным ресурсом при отображении. Результат включает
полную модель, LOD, геометрию теней, прозрачное превью и подробный source.
Файлы публикуются в S3 общим процессом моделей; связь с публичным итемом
создаётся отдельно через MCP. Две записи одного существа из разных книг могут
использовать один ресурс.

## Исходники и рецепты

Рецепты, геометрические построения и проверки находятся в
[scripts/creatures](../../scripts/creatures/). Бинарные результаты, текстуры,
референсы и отчёты остаются в игнорируемом `models/creatures/`.

[kobold-family.json](../../scripts/creatures/kobold-family.json) задаёт стабильные
UUID девяти новых моделей, itemIds, имена и файлы пяти ресурсов.
[kobold-landmarks.json](../../scripts/creatures/kobold-landmarks.json) хранит
измеренные точки принятого кобольда 1635 в координатах Blender. При смене базовой
геометрии эти точки требуют новой проверки.

Варианты кобольда используют принятую модель из `models/creatures/kobold-1635-v2`:
`kobold-1635.glb`, `kobold-1635-lod.glb`, `kobold-1635-master.glb` и
`kobold-1635-shadow.glb`. Экипировка строится отдельной геометрией: зимняя одежда,
меч, копьё и щит, инструменты, посох, механическое снаряжение и крылья.
Одежда подгоняется лучами по BVH корпуса. Старое оружие удаляется у вариантов
с заменой; вампир получает открытую кисть, клыки и серую палитру.

Стражник 1672 подготовлен независимо: публичная иллюстрация итема → изображение
миниатюры на прозрачном фоне → нативный экспорт TRELLIS.2. Промпт сохранён в
[guard-1672-reference.txt](../../scripts/creatures/guard-1672-reference.txt).
`generate-trellis.py` принимает изображение и папку результата; параметры этого
исходника: seed 1672, resolution 1024, extraction 300000, textureSize 2048.
Удалённая генерация недетерминирована; для воспроизведения обработки нужен
сохранённый `trellis-native/generated-original.glb`.

## Геометрия и материалы

Для инструментов нужны Blender 5.1, Node, runtime из
`scripts/maps/setup-model-tools.sh` и Python-окружение с зависимостями из
[requirements.txt](../../scripts/creatures/requirements.txt).

`build-kobold-family.py` сохраняет текстуры и видимую полную/LOD-геометрию принятого
корпуса. `kobold_equipment.py` и `miniature_geometry.py` строят снаряжение,
`bake_equipment.py` запекает его цвет, нормали и roughness/metalness в общий атлас.
Это сокращает число частей от отдельных заклёпок и меховых прядей. Небольшие
эмиссивные детали сохраняются отдельно. В GLB нет зависимости от процедурных
нод Blender.

`kobold_clothing.py` строит объёмную одежду с соединёнными боками, плечами,
открытым вырезом и проймами. Лучи идут из измеренной оси туловища наружу,
поэтому руки перед грудью не вытягивают ткань вперёд. Для всех детализаций
используется одна принятая поверхность render; меняется плотность сетки,
а не форма посадки. Низ свободно свисает от пояса. Верх и пояс проверяются
на зазор до тела не более 0,022 клетки; основной кусок ткани обязан иметь
одну связную компоненту. Ремни рюкзака и крепления копья привязаны к телу.

`clothing_fit.py` удаляет закрытые тканью полигоны кожи, предотвращая прохождение
грудных пластин сквозь одежду. Маска отступает от выреза и пройм: под одежду должен
попасть весь полигон тела. Возле краёв сохраняется перекрытие кожи с тканью,
открытые части тела остаются на месте. `creation.json` хранит по каждой роли
зазор, связность и число закрытых полигонов. Тени используют более редкую сетку
ткани, чем видимый LOD.

Для стражника `prepare-native-geometry.py` делает геометрическое QEM-упрощение
и новую UV-развёртку xatlas: около 44 тысяч треугольников render, 12 тысяч LOD
и 3,5 тысячи shadow до добавления подставки. `bake-native-miniature.py` переносит
albedo, PBR и tangent normals с нативной модели. Параметры стражника:
`--height 1.4 --rotation -45`. Один и тот же transform применяется ко всем
четырём ресурсам, поэтому силуэт, ориентация и тень совпадают.

Первые исходники кобольдов и стражника содержали подставку диаметром 0,9 клетки.
Перед текущей публикацией основания отделены через `separate-bases.mjs`,
а начало фигурок перенесено в точку ног. Основания зарегистрированы отдельно
для размеров 0,5/1/2/3/4/6/8. После экспорта GLB вертикаль — Y.
Shadow не содержит текстур. Контракт — [отдельные подставки](item-models.md#отдельные-подставки-и-управление-существами).

`optimize-miniature.mjs` сокращает карты и удаляет дубли: albedo до 2048 для
render и 1024 для LOD, normal вдвое меньше, ORM вчетверо меньше. Albedo — JPEG,
карты данных — PNG. Обработку запускать на свежем экспорте, чтобы повторно
не перекодировать JPEG. Полные экспортные текстуры остаются рядом с `.blend`,
оптимизированные карты render также извлекаются в `textures/`.

## Сборка и проверка текущего набора

### Совомед 2579: исходная сетка TRELLIS и размер 2×2

[Рецепт](../../scripts/creatures/owlbear-2579.json) привязан к публичному
совомеду из MM. [Промпт референса](../../scripts/creatures/owlbear-2579-reference.txt)
использован встроенным imagegen с иллюстрацией итема.
Текущая модель получена прямым экспортом TRELLIS.2: seed 2579, resolution 1024,
decimation target 300000, textureSize 2048. Личный PRO-аккаунт разрешён
пользователем; генератор принимает его только с явным `--allow-pro`.
Ключ читается скрытым вводом `--token-stdin`, остаётся в памяти процесса.

Первая попытка прямого экспорта была отклонена бесплатной квотой. Черновая
локальная реконструкция, её ракурсы и скрипты сохранены отдельно в
`models/creatures/owlbear/`, исходники эксперимента — в `workflow/` этой папки.
В опубликованной версии используется исходный GLB сервиса;
текущие результаты находятся в `models/creatures/owlbear-native/`.

`prepare-native-geometry.py` делает QEM и xatlas для render/LOD; для тонкого
оперения LOD имеет целевой бюджет 24000 вместо стандартных 12000 треугольников.
`bake-native-miniature.py` переносит albedo/PBR с исходника и запекает настоящие
геометрические tangent normals. Отдельный проход покрытия позволяет заполнить
пропуски лучей и расширить края UV-островов. Обратные tangent normals на тонких
перьях разворачиваются в наружную полусферу, предотвращая инвертированное освещение.
Подробный source сохраняет нативную текстурированную сетку, shadow — только
геометрию. Это игровая статическая модель, не подготовленная для 3D-печати.

Один transform применяется ко всем ролям: `--rotation -45 --footprint .88
--no-base --token-size 2`. Ступни на Y=0, диаметр нативной геометрии 0,88,
основания в файле нет. Размер жетона умножает геометрию один раз: при
`token.size:2` диаметр 1,76 клетки, отдельная двухклеточная подставка — 1,8.
Метаданные модели остаются 1×1, так как это нормализованный ресурс жетона.

```bash
models/creatures/.generation-runtime/bin/python scripts/creatures/generate-trellis.py models/creatures/owlbear-native/miniature-reference.png models/creatures/owlbear-native/trellis-native --seed 2579 --resolution 1024 --token-stdin --allow-pro
models/creatures/.generation-runtime/bin/python scripts/creatures/prepare-native-geometry.py models/creatures/owlbear-native --lod-triangles 24000
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/creatures/bake-native-miniature.py -- models/creatures/owlbear-native --rotation -45 --footprint .88 --no-base --token-size 2
node scripts/creatures/optimize-miniature.mjs models/creatures/owlbear-native
node scripts/creatures/verify-single-miniature.mjs models/creatures/owlbear-native
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python scripts/creatures/render-final-miniature.py -- models/creatures/owlbear-native
node scripts/creatures/package-miniature.mjs models/creatures/owlbear-native scripts/creatures/owlbear-2579.json
python3 scripts/creatures/publish-miniature.py models/creatures/owlbear-native scripts/creatures/owlbear-2579.json --update-from models/creatures/owlbear/publication.json
```

Последняя команда по умолчанию проверяет файлы локально. С `--publish` она
публикует проверенный ресурс через MCP. Первичная публикация назначает основную
модель; чужую привязку заменять отказывается. `--update-from` сверяет assets
с прежним подтверждённым отчётом, сохраняет свежие не связанные с файлами
метаданные и все привязки. Повтор уже выполненного обновления допустим,
посторонняя версия исходных assets останавливает запись.
`publication.json` подтверждает итоговые manifests и связи.
`--server-token` требует разрешения на конкретный серверный файл.

### Семейство кобольдов и стражник

Команды выполняются из корня проекта. Каталог `kobold-family` должен содержать
сохранённый нативный исходник стражника и принятый исходник кобольда рядом с ним.

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/creatures/build-kobold-family.py -- models/creatures/kobold-family
models/creatures/.generation-runtime/bin/python scripts/creatures/prepare-native-geometry.py models/creatures/kobold-family/guard-1672
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/creatures/bake-native-miniature.py -- models/creatures/kobold-family/guard-1672 --height 1.4 --rotation -45
```

После экспорта для каждой из девяти папок выполняется
`node scripts/creatures/optimize-miniature.mjs ПАПКА`. Затем:

```bash
node scripts/creatures/verify-miniatures.mjs models/creatures/kobold-family
models/creatures/.generation-runtime/bin/python scripts/creatures/prepare-family.py models/creatures/kobold-family
python3 scripts/creatures/publish-family.py models/creatures/kobold-family
```

Проверка требует встроенные буферы и изображения, конечные координаты, корректные
UV, PBR-карты render/LOD, отсутствие анимаций и скелета, нулевую опорную плоскость,
ограничения числа треугольников и частей. Расхождение границ LOD с render должно
быть меньше 0,04 клетки. Проверка границ не заменяет визуальную оценку силуэта.
Для шести костюмов проверяются отчёты посадки во всех четырёх ролях.
Сборщик сохраняет дополнительные боковые ракурсы `left.png` и `right.png`;
проверять их вместе с передним и задним видом, включая края пройм и выреза.

`prepare-family.py` создаёт поэлементные manifests и общий `publish/catalogue.json`,
вычисляет maxHeight, копирует базового кобольда 1635 в галерею и собирает контактный
лист `miniatures.jpg`. Галерея использует локальную копию Three из принятого
прототипа. Полная модель, LOD, source, вид сверху, масштаб на поле и серый материал
помогают сравнить геометрию и покраску.

```bash
python3 -m http.server 15305 --bind 127.0.0.1 --directory models/creatures/kobold-family
```

Адрес галереи — `http://127.0.0.1:15305/preview.html`.
В другом терминале `node scripts/creatures/verify-gallery.mjs models/creatures/kobold-family`
проверяет загрузку всех полных/LOD-вариантов, source стражника и мобильный размер
без ошибок WebGL. Отчёт — `viewer-verification.json`.

## Публикация

По умолчанию `publish-family.py` выполняет локальную проверку: состав набора,
UUID, пять ролей, размер и SHA-256 каждого файла. Сеть и ключи не используются.
С `--publish` применяется настроенный `MCP_AUTH_TOKEN`; `--server-token` допускается
только при разрешённом пользователем чтении конкретного серверного файла.
Токен остаётся в памяти процесса и не попадает в отчёты.

Перед записью сохраняется `before-bindings.json`. Go-команда `map-model-upload`
передаёт файлы прямо в S3 и регистрирует девять моделей. Затем выполняются
двенадцать идемпотентных `item_model_bind` с основной моделью. Привязка 1635
проверяется на неизменность. Итоговое чтение сверяет все новые asset manifests
и связи; только после него создаётся `publication.json` с `verified:true`.
Публикация набора не атомарна целиком: после сбоя повторный запуск продолжает
идемпотентную регистрацию и привязку. О готовности судят по итоговому отчёту.

Обновление части набора выполняется с `--only` и `--update-from ПРЕЖНИЙ_ОТЧЁТ`.
Скрипт сверяет прежние assets со свежим MCP-реестром и отказывается затирать
постороннюю версию. Из свежих метаданных меняются только пять ресурсов и
высота по новой геометрии. Все привязки итемов сохраняются; регистрация новых
основных моделей в этом режиме не выполняется. Перед записью сохраняются
`update-before-models.json` и `update-before-bindings.json`, итоговая проверка
assets, метаданных и связей — в `update-publication.json`. Повтор после сбоя
допускает уже опубликованные ресурсы того же проверенного набора.

Миниатюры имеют `hidden:true`, `tileType:object`, коллекцию CRE и не появляются
в строительной палитре. Поле выбирает их через itemIds общего каталога.

## Ограничения результата

Кобольды используют общий корпус и позу, различаясь реальной геометрией
снаряжения и частью палитры. Одежда и мелкие аксессуары упрощены относительно
рисунков справочника. Это игровые статические миниатюры; скелет, анимации,
водонепроницаемая сетка и подготовка к 3D-печати не выполняются.

## Связанные страницы

[Оглавление wiki](../README.md) · [3D-модели итемов](item-models.md) ·
[Журнал моделей](maps-model-log.md) · [Общий процесс S3](maps-model-pipeline.md)
