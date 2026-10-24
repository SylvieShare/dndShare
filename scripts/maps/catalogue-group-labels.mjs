export const groupLabels = Object.fromEntries(
  `
BE-border|Бордюры|Borders
BE-frames|Каркасы и опоры|Frames and supports
LC-bones|Кости|Bones
LC-bridges|Мосты|Bridges
LC-columns|Колонны|Columns
LC-crystals|Кристаллы|Crystals
LC-flat-walls|Плоские стены|Flat walls
LC-frames|Каркасы и леса|Frames and scaffolding
LC-ground|Пол|Ground
LC-mine|Шахта|Mine
LC-mushrooms|Грибы|Mushrooms
LC-railway|Железная дорога|Railway
LC-rocks|Скалы|Rocks
LC-stairs|Лестницы|Stairs
LC-stalagmites|Сталагмиты|Stalagmites
LC-wagon|Вагонетки|Wagons
LC-walls|Стены|Walls
LC-water|Вода|Water
LC-wells|Колодцы|Wells
MA-ma-dungeonchest-full-prop|Сундуки|Chests
MED-bar|Барные стойки|Bars
MED-balcony|Балконы|Balconies
MED-barrel|Бочки|Barrels
MED-bath|Ванны|Baths
MED-bath-objects|Принадлежности для купания|Bath accessories
MED-bed|Кровати|Beds
MED-buffet|Буфеты|Buffets
MED-fireplaces|Камины|Fireplaces
MED-fountain|Фонтаны|Fountains
MED-frames|Каркасы этажей|Level frames
MED-ground|Грунт|Ground
MED-ground-wood|Деревянный пол|Wooden ground
MED-lights|Светильники|Lights
MED-market|Рынок|Market
MED-path|Тропинки|Paths
MED-roof|Крыши|Roofs
MED-pavement|Мощение|Pavement
MED-seating|Стулья и табуреты|Seating
MED-stair|Лестницы|Stairs
MED-table|Столы|Tables
MED-tavern-sign|Вывески таверны|Tavern signs
MED-trap|Люки|Traps
MED-walls|Стены|Walls
MED-wardrobe|Шкафы|Wardrobes
MED-wooden-crates|Деревянные ящики|Wooden crates
MED-wooden-plank|Деревянные настилы|Wooden planks
MH-bridges|Мосты|Bridges
MH-campfire|Костры|Campfires
MH-dirt-ground|Земля|Dirt ground
MH-dirt-path|Грунтовые тропинки|Dirt paths
MH-dolmens|Дольмены|Dolmens
MH-dragon-bones|Кости дракона|Dragon bones
MH-frames|Каркасы и переходники|Frames and adaptors
MH-high-cliffs|Скалы верхнего яруса|High cliffs
MH-high-river|Реки верхнего яруса|High rivers
MH-high-water|Вода верхнего яруса|High water
MH-high-waterfall|Водопады верхнего яруса|High waterfalls
MH-lock-border|Соединительные бордюры|Lock borders
MH-low-cliffs|Скалы нижнего яруса|Low cliffs
MH-low-river|Реки нижнего яруса|Low rivers
MH-low-water|Вода нижнего яруса|Low water
MH-low-waterfall|Водопады нижнего яруса|Low waterfalls
MH-medium-cliffs|Скалы среднего яруса|Medium cliffs
MH-medium-river|Реки среднего яруса|Medium rivers
MH-medium-water|Вода среднего яруса|Medium water
MH-medium-waterfall|Водопады среднего яруса|Medium waterfalls
MH-river|Реки|Rivers
MH-rocks|Скалы|Rocks
MH-ruins|Руины|Ruins
MH-scenic-level|Декоративные ярусы|Scenic levels
MH-vegetation|Растения|Vegetation
MH-water|Вода|Water
MH-wooden-bridges|Деревянные мосты|Wooden bridges
TS-bins|Деревянные чаны|Wooden bins
TS-bridge|Мосты|Bridges
TS-cisterns|Цистерны|Cisterns
TS-columns|Колонны|Columns
TS-containers|Ящики и сокровища|Containers and treasure
TS-door|Двери|Doors
TS-door-pipe|Двери с трубами|Pipe doors
TS-frames|Каркасы|Frames
TS-ground|Пол|Ground
TS-pipes|Трубы|Pipes
TS-small-walls|Низкие стены|Small walls
TS-stairs|Лестницы|Stairs
TS-tunnels|Тоннели|Tunnels
TS-walls|Стены|Walls
TS-water|Вода и каналы|Water and channels
TS-wells|Колодцы|Wells
UD-altar|Алтари|Altars
UD-beds|Кровати|Beds
UD-bridges|Мосты|Bridges
UD-columns|Колонны|Columns
UD-fountains|Фонтаны|Fountains
UD-frames|Каркасы и опоры|Frames and supports
UD-ground|Пол|Ground
UD-hole-trap|Ловушки-провалы|Pit traps
UD-lights|Факелы и жаровни|Torches and braziers
UD-passages|Двери и арки|Doors and arches
UD-prison|Тюрьма|Prison
UD-small-walls|Низкие стены|Small walls
UD-stairs|Лестницы|Stairs
UD-torture|Орудия пыток|Torture devices
UD-walls|Стены|Walls
UD-water|Вода|Water
UD-well|Колодцы|Wells
`
    .trim()
    .split("\n")
    .map((line) => {
      const [code, name, nameEn] = line.split("|");
      return [code, { name, nameEn }];
    }),
);
