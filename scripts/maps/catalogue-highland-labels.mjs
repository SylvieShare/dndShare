export const highlandNames = Object.fromEntries(
  `
Bridge Center|Центральная секция моста
Bridge Center Broken|Разрушенная центральная секция моста
Bridge Center River|Центральная секция моста над рекой
Bridge Center Water|Центральная секция моста над водой
Bridge Center Water Straight|Центральная секция моста у прямого берега
Bridge Center Water Straight Borken|Разрушенная центральная секция моста у прямого берега
Bridge Cross|Перекрёсток моста
Bridge River|Мост над рекой
Bridge River Broken|Разрушенный мост над рекой
Bridge Ruins|Руины моста
Bridge Start|Начало моста
Bridge Start Broken|Разрушенное начало моста
Bridge Start River|Начало моста над рекой
Bridge Start River Broken|Разрушенное начало моста над рекой
Bridge Start Water|Начало моста над водой
Bridge Start Water Broken|Разрушенное начало моста над водой
Cart Ruins|Обломки повозки
DB High Wall|Высокая стена стандартной сетки
DB Low Wall|Низкая стена стандартной сетки
DB Medium Wall|Средняя стена стандартной сетки
DB to XL Grid Adaptor|Переходник стандартной сетки на увеличенную
Dirt Grass 1|Земля с травой 1
Dirt Grass 2|Земля с травой 2
Dirt Ground|Земля
Dirt Ground 1 Corner|Земля с одним наружным углом
Dirt Ground 2 Corners|Земля с двумя наружными углами
Dirt Ground 3 Corners|Земля с тремя наружными углами
Dirt Ground 4 Corners|Земля с четырьмя наружными углами
Dirt Ground Angle|Земля с внутренним углом
Dirt Ground Straight|Прямой край земли
Dirt Ground Straight Pines|Прямой край земли с соснами
Dirt Path|Грунтовая тропинка
Dirt Path 2 Corners|Грунтовая тропинка с двумя наружными углами
Dirt Path Angle|Поворот грунтовой тропинки
Dirt Path Corner|Наружный угол грунтовой тропинки
Dirt Path End|Окончание грунтовой тропинки
Dirt Path Pines|Грунтовая тропинка с соснами
Dirt Path Right Corner (Fixed)|Правый угол грунтовой тропинки
Dolmens|Дольмены
Dragon Body Bones|Кости туловища дракона
Dragon Head Bones|Череп дракона
Dragon Tail Bones|Кости хвоста дракона
Giant Pine|Гигантская сосна
Grass|Трава
Lit Campfire|Горящий костёр
Unlit Campfire|Погасший костёр
Little Rock|Маленькая скала
Lock Border|Соединительный бордюр
Lock Border Angle|Угловой соединительный бордюр
Mushrooms 1|Грибы 1
Mushrooms 2|Грибы 2
Pines 1|Сосны 1
Pines 2|Сосны 2
Pines 3|Сосны 3
Scenic Level 1 Face|Декоративный ярус с одной стороной
Scenic Level 2 Faces|Декоративный ярус с двумя сторонами
Scenic Level 3 Faces|Декоративный ярус с тремя сторонами
Scenic Level 4 Faces|Декоративный ярус с четырьмя сторонами
Scenic Level Angle|Угол декоративного яруса
Small Crater 1|Маленький кратер 1
Small Crater 2|Маленький кратер 2
Small Crater 3|Маленький кратер 3
Small Ruins|Маленькие руины
Tall Ruins 1|Высокие руины 1
Tall Ruins 2|Высокие руины 2
Water 1 Corner|Вода с одним наружным углом
Water 2 Corners|Вода с двумя наружными углами
Water 3 Corners|Вода с тремя наружными углами
Water 4 Corners|Вода с четырьмя наружными углами
Water Start|Начало водоёма
Wooden Bridge Broken|Разрушенный деревянный мост
Wooden Bridge River|Деревянный мост над рекой
Wooden Bridge Water|Деревянный мост над водой
Wooden Bridge Water Straight|Деревянный мост у прямого берега
XL Lock Grid|Увеличенный соединительный каркас
`
    .trim()
    .split("\n")
    .map((line) => line.split("|")),
);
const shapes = Object.fromEntries(
  `
Angle|Внутренний угол
Corridor|Коридор
Corridor 1|Коридор 1
Corridor 2|Коридор 2
Corridor Branches|Коридор с ветками
End|Окончание скалы
Grotto Entrance|Вход в грот
Grotto Tunnel|Тоннель грота
Light Level|Облегчённый ярус
Rock Level|Скальный ярус
Stairs|Лестница
Step Angle 1|Угол ступенчатой скалы 1
Step Angle 2|Угол ступенчатой скалы 2
Step Angle Pines|Угол ступенчатой скалы с соснами
Step Angle Water|Угол ступенчатой скалы у воды
Step Wall 1|Ступенчатая скальная стена 1
Step Wall 2|Ступенчатая скальная стена 2
Step Wall 3|Ступенчатая скальная стена 3
Step Wall Pines|Ступенчатая скальная стена с соснами
Step Wall Water|Ступенчатая скальная стена у воды
Wall|Скальная стена
Wall 1|Скальная стена 1
Wall 2|Скальная стена 2
Wall 3|Скальная стена 3
Wall Pines|Скальная стена с соснами
Angle Pines|Внутренний угол с соснами
Ruins 1|Руины 1
Ruins 2|Руины 2
Water Angle|Вода с внутренним углом
Water Straight|Прямой край воды
River 2 Corners|Река с двумя наружными углами
River Angle|Поворот реки
River Corridor|Речной коридор
River Corridor 1|Речной коридор 1
River Corridor 2|Речной коридор 2
River Corridor Branches|Речной коридор с ветками
River End|Окончание реки
River Left Corner|Левый наружный угол реки
River Right Corner|Правый наружный угол реки
River Straight|Прямая река
Waterfall|Водопад
Waterfall 2 Angles|Водопад с двумя внутренними углами
Waterfall 2 Corners|Водопад с двумя наружными углами
Waterfall Corridor|Коридор водопада
Waterfall End|Окончание водопада
Waterfall Left Angle|Левый внутренний угол водопада
Waterfall Right Angle|Правый внутренний угол водопада
Waterfall Left Corner|Левый наружный угол водопада
Waterfall Right Corner|Правый наружный угол водопада
Waterfall Straight|Прямой водопад
`
    .trim()
    .split("\n")
    .map((line) => line.split("|")),
);
for (const [shape, ru] of Object.entries(shapes)) {
  for (const [height, label] of [
    ["Low", "нижний ярус"],
    ["Medium", "средний ярус"],
    ["High", "верхний ярус"],
  ])
    highlandNames[`${height} ${shape}`] = `${ru} · ${label}`;
  if (shape.startsWith("River ")) highlandNames[shape] = ru;
}
