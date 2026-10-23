# Подготовка миниатюр существ

← [3D-модели итемов](item-models.md) · [Обработка моделей](maps-model-pipeline.md)

Миниатюра — статический GLB с PBR-текстурами и подставкой. Результат включает
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

`build-kobold-family.py` сохраняет текстуры и полную/LOD-геометрию принятого
корпуса. `kobold_equipment.py` и `miniature_geometry.py` строят снаряжение,
`bake_equipment.py` запекает его цвет, нормали и roughness/metalness в общий атлас.
Это сокращает число частей от отдельных заклёпок и меховых прядей. Небольшие
эмиссивные детали сохраняются отдельно. В GLB нет зависимости от процедурных
нод Blender.

Для стражника `prepare-native-geometry.py` делает геометрическое QEM-упрощение
и новую UV-развёртку xatlas: около 44 тысяч треугольников render, 12 тысяч LOD
и 3,5 тысячи shadow до добавления подставки. `bake-native-miniature.py` переносит
albedo, PBR и tangent normals с нативной модели. Параметры стражника:
`--height 1.4 --rotation -45`. Один и тот же transform применяется ко всем
четырём ресурсам, поэтому силуэт, ориентация и тень совпадают.

Подставка имеет диаметр 0,9 клетки, начало координат находится на её нижней
плоскости. После экспорта GLB вертикаль — Y. У кобольда наследуется принятая
подставка; стражнику она добавляется отдельно. Shadow не содержит текстур.

`optimize-miniature.mjs` сокращает карты и удаляет дубли: albedo до 2048 для
render и 1024 для LOD, normal вдвое меньше, ORM вчетверо меньше. Albedo — JPEG,
карты данных — PNG. Обработку запускать на свежем экспорте, чтобы повторно
не перекодировать JPEG. Полные экспортные текстуры остаются рядом с `.blend`,
оптимизированные карты render также извлекаются в `textures/`.

## Сборка и проверка текущего набора

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
