// Core pp. 347–349, special properties not represented by the basic weapon table.
export function completeWeapons(core) {
  const rows = {
    "air-pistol": [
      { noCritical: true },
      "Пейнтбольный пистолет: урона нет. Кислотный шарик снижает SP поражённой брони на 1 даже без урона.",
    ],
    "constitutional-arms-hurricane-assault-weapon": [
      { hands: 2, noAimed: true, bodyRequired: 11, reloadActions: 2 },
      "Дробовик ROF 2; прицельная стрельба недоступна. BODY 11+ или станок, перезарядка занимает два действия.",
    ],
    dartgun: [{}, "Стреляет стрелами любых типов, кроме Basic."],
    flamethrower: [
      { hands: 2, damage: "3d6", noAimed: true, noCritical: true },
      "Тяжёлое оружие; правила выстрела зажигательной дробью, без критических травм. Горение наносит 4 HP/ход до тушения.",
    ],
    "kendachi-mono-three": [
      { ignoreSPBelow: 11 },
      "С подходящим биометрическим ключом полностью игнорирует SP ниже 11. При SP 11+ действует половина брони.",
    ],
    "malorian-arms-3516": [
      {},
      "5d6, excellent, встроенный Smartgun Link. Для стрельбы нужны подключённые интерфейсные разъёмы или подкожный захват.",
    ],
    microwaver: [
      {},
      "Без обычного урона: Cybertech DV 15. При провале ведущий отключает два импланта или носимых электронных устройства на минуту. Аккумулятор: восемь выстрелов, час зарядки.",
    ],
    "militech-cowboy-u-56-grenade-launcher": [
      { bodyRequired: 11, reloadActions: 2, noAimed: true },
      "Гранатомёт ROF 2, любые гранаты. BODY 11+ или станок, перезарядка два действия.",
    ],
    "rhinemetall-emg-86-railgun": [
      { ignoreSPBelow: 11, bodyRequired: 11, reloadActions: 2, noAimed: true },
      "Полностью игнорирует SP ниже 11. Heavy Weapons; без автоогня и прицельной стрельбы. BODY 11+ или станок, перезарядка два действия.",
    ],
    shrieker: [
      {},
      "Без обычного урона: Resist Torture/Drugs DV 15 или травма слуха. Стрелок без защиты слуха также получает эту травму. Аккумулятор: восемь выстрелов, час зарядки.",
    ],
    "stun-baton": [
      { noCritical: true, nonlethal: true },
      "Урон не изнашивает броню и не причиняет критических травм. Вместо снижения HP ниже 1 цель теряет сознание при 1 HP.",
    ],
    "stun-gun": [
      { noCritical: true, nonlethal: true },
      "Урон не изнашивает броню и не причиняет критических травм. Вместо снижения HP ниже 1 цель теряет сознание при 1 HP.",
    ],
    "tsunami-arms-helix": [
      {
        autofireAmmo: 20,
        autofireOnly: true,
        noAimed: true,
        bodyRequired: 11,
        reloadActions: 2,
      },
      "Только автоогонь, 20 патронов за атаку, множитель до 5. BODY 11+ или станок, перезарядка два действия.",
    ],
  };
  for (const [key, [facts, text]] of Object.entries(rows)) {
    const i = core.items.find((i) => i.key === "weapon-" + key);
    if (i) {
      Object.assign(i.facts, facts);
      i.summary = text;
    }
  }
}
