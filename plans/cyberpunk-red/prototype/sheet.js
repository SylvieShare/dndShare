RED.resources = () => `<div class="panel stack">
 <button class="health-box" data-action="health">${RED.metric("Здоровье", RED.state.hp, 40, "health")}</button>
 <div class="row between"><span class="caption">Тяжёлое ранение</span><b>ниже 20 HP</b></div>
 <hr class="divider"><button class="health-box" data-action="humanity">${RED.metric("Человечность", RED.state.humanity, 60, "humanity")}</button>
 <div class="row between"><span class="caption">Текущая EMP</span><b>${Math.floor(RED.state.humanity / 10)}</b></div>
 <hr class="divider"><div class="row between"><div><span class="caption">Удача</span><div class="metric">${RED.state.luck}<small> / 5</small></div></div><button data-action="luck">Изменить</button></div></div>`;
RED.protection = () =>
  `<div class="panel"><h2>Защита</h2><div class="two"><div><div class="caption">Тело · SP</div><div class="metric">10 <small>/ 11</small></div></div><div><div class="caption">Голова · SP</div><div class="metric">11 <small>/ 11</small></div></div></div><hr class="divider"><div class="row between"><span class="muted">Штраф брони</span><b>0</b></div><p class="caption section">Лёгкая бронекуртка · износ тела 1</p><button class="quiet" data-action="armor">Посмотреть броню →</button></div>`;
RED.skillList = (compact = false) =>
  `<div class="${compact ? "panel" : "stack"}"><div class="row between"><h2>Навыки</h2><span class="pill">STAT + LVL</span></div><input class="section" placeholder="Найти навык…" aria-label="Поиск навыка" data-skill-search><div data-skills>${RED.skills
    .slice(0, compact ? 8 : RED.skills.length)
    .map(
      ([name, stat, rank, group, x]) =>
        `<div class="skill-row" data-skill-name="${name.toLowerCase()}"><div>${name}${x ? ' <span class="pill">×2</span>' : ""}<span class="caption">${stat} ${RED.state.stats[stat]} + навык ${rank}</span></div><button class="number" data-roll="${name}" data-base="${RED.state.stats[stat] + rank}">${RED.state.stats[stat] + rank}</button></div>`,
    )
    .join(
      "",
    )}</div>${compact ? '<button class="quiet section" data-tab="skills">Все навыки →</button>' : '<p class="caption">В макете показана выборка навыков. Полный каталог и специализации описаны в плане наполнения.</p>'}</div>`;
RED.weapon = () =>
  `<article class="weapon"><div class="row"><div class="weapon-mark">HG</div><div class="grow"><h2>Тяжёлый пистолет</h2><p class="caption">Пистолеты · REF 8 + навык 6</p></div><button class="quiet" data-action="weapon" aria-label="Свойства тяжёлого пистолета">•••</button></div><div class="weapon-metrics"><div><small>Урон</small><b>3d6</b></div><div><small>Магазин</small><b>${RED.state.ammo}<span class="muted"> / 8</span></b></div><div><small>Темп огня</small><b>2</b></div></div><div class="row"><button class="primary" data-roll="Тяжёлый пистолет" data-base="14">Атака · d10 + 14</button><button data-action="reload">Зарядить</button></div></article>`;
RED.cyber = () =>
  `<div class="stack"><div><h2>Киберware</h2><p class="muted">Установки, свободные слоты и человечность</p></div><div class="panel"><div class="row between"><h3>Нейронная связь</h3><span class="pill purple">2 / 5 слотов</span></div><div class="list-row"><div><b>Интерфейсные разъёмы</b><p>Подключение к оборудованию</p></div><button data-action="implant">Сведения</button></div><div class="list-row"><div><b>Чип-разъём</b><p>Установка подключаемых чипов</p></div><button data-action="implant">Сведения</button></div><button class="quiet section" data-action="install">+ Установить опцию</button></div><div class="panel"><div class="row between"><h3>Кибероптика</h3><span class="pill">Левая / правая</span></div><p class="empty">Основание не установлено</p><button data-action="install">Подобрать имплант</button></div><div class="note">Перед установкой: основание → слоты → совместимость → изменение Humanity. Снятие импланта и терапия оформляются отдельно.</div></div>`;
RED.net = () =>
  `<div class="stack"><div class="row between"><div><h2>Сеть</h2><p class="muted">Интерфейс · ранг 4</p></div><span class="pill purple">NET-сцена</span></div><div class="panel"><div class="row between"><h3>Кибердека</h3><span class="pill">Занято 4 / 7</span></div><div class="list-row"><div><b>Программы</b><p>Активные и загруженные программы</p></div><button data-action="programs">Открыть</button></div><div class="row wrap section"><button class="primary" data-roll="Interface / Pathfinder" data-base="4">Pathfinder · d10 + 4</button><button data-action="netaction">NET-действие</button></div></div><div class="panel"><h2>Обнаруженная архитектура</h2><div class="net-track"><div class="net-floor"><span class="floor-number">01</span><div><b>Точка входа</b><p class="caption">Соединение установлено</p></div><span class="pill good">Пройдено</span></div><div class="net-floor current"><span class="floor-number">02</span><div><b>Пароль</b><p class="caption">Текущее препятствие · DV 8</p></div></div><div class="net-floor"><span class="floor-number">?</span><div><b>Не исследовано</b><p class="caption">Откроется в ходе сцены</p></div></div></div></div><p class="caption">Демонстрация композиции. Скрытые этажи мастера не передаются в лист игрока.</p></div>`;
RED.gear = () =>
  `<div class="stack"><div class="row between"><h2>Предметы</h2><button data-action="money">${RED.state.cash} eb · кошелёк</button></div><div class="panel"><div class="row between"><h3>С собой</h3><button class="quiet" data-action="catalog">+ Добавить</button></div>${[
    ["Агент", "Личное устройство"],
    ["Набор инструментов", "Техническое снаряжение"],
    ["Базовые патроны", "Запас · 24 шт."],
    ["Кибердека", "Программы и оборудование"],
  ]
    .map(
      ([n, d]) =>
        `<div class="list-row"><div><b>${n}</b><p>${d}</p></div><button data-detail="${n}">Открыть</button></div>`,
    )
    .join(
      "",
    )}</div><div class="panel"><h3>В тайнике</h3><p class="empty">Добавь контейнер или перенеси вещи</p><button data-action="container">+ Контейнер</button></div></div>`;
RED.rolePane = () =>
  `<div class="stack"><div class="panel"><div class="eyebrow">${RED.role()[2]}</div><h2 class="section">${RED.role()[1]} · ранг 4</h2><p class="muted">${RED.role()[3]}</p><p class="section">${RED.role()[4]}</p><button class="primary section" data-action="role">Настроить способность</button></div><div class="panel"><div class="row between"><div><div class="caption">Очки развития</div><div class="ip-value">80 IP</div></div><button data-action="advance">Развитие →</button></div><hr class="divider"><div class="row between"><span>Репутация</span><b>2</b></div></div><div class="panel"><h2>История развития</h2><div class="list-row"><div><b>Завершена работа</b><p>Награда ведущего · демонстрация</p></div><b>+80 IP</b></div></div></div>`;
RED.life = () =>
  `<div class="stack"><div class="panel"><div class="row"><div class="avatar">ST</div><div><div class="eyebrow">Watson / Night City</div><h2>${RED.escape(RED.state.name)}</h2><p class="muted">Нетраннер с собственной чертой</p></div></div><p class="story-lead section">${RED.escape(RED.state.lifepath)}</p><button class="quiet section" data-action="life">Изменить историю →</button></div><div class="two"><div class="panel"><h2>Связи</h2><div class="list-row"><div><b>Лина</b><p>Друг · держит мастерскую</p></div><span class="pill">Доверие</span></div><div class="list-row"><div><b>Бывший заказчик</b><p>Враг · незаконченная работа</p></div></div></div><div class="panel"><h2>Жизнь в городе</h2><div class="list-row"><div><b>Грузовой контейнер</b><p>Жильё</p></div></div><div class="list-row"><div><b>Образ жизни</b><p>Расходы, даты оплаты, услуги</p></div><button data-action="expenses">Открыть</button></div></div></div></div>`;
RED.base = () =>
  `<div class="stack"><div class="panel"><div class="row between"><h2>Готовность к работе</h2><span class="pill ${RED.state.hp < 20 ? "warn" : "good"}">${RED.state.hp < 20 ? "Тяжело ранен" : "На ногах"}</span></div><div class="three"><div><div class="caption">Инициатива</div><button class="number" data-roll="Инициатива" data-base="8">d10 + 8</button></div><div><div class="caption">Движение</div><div class="metric">12 <small>м</small></div></div><div><div class="caption">Роль</div><div class="metric">4 <small>ранг</small></div></div></div></div><div class="base-grid desktop-hidden">${RED.resources()}${RED.protection()}</div>${RED.weapon()}<div class="panel"><div class="row between"><h2>Характеристики</h2><button class="quiet" data-tab="skills">Навыки →</button></div><div class="stat-grid">${RED.stats.map(([k, n]) => `<div class="stat"><small>${k}</small><b>${RED.state.stats[k]}</b></div>`).join("")}</div><p class="caption">Исходные значения. Эффекты и текущие ресурсы раскрываются отдельно.</p></div><div class="panel"><h2>Последние события</h2><div class="list-row"><div><b>Броня приняла попадание</b><p>Тело · SP 11 → 10</p></div><span class="caption">Вчера</span></div></div></div>`;
RED.sheet = () => {
  const content = {
    base: RED.base,
    skills: () => RED.skillList(),
    combat: () =>
      `<div class="stack">${RED.weapon()}${RED.protection()}<div class="panel"><h2>Другие действия</h2><div class="row wrap"><button data-action="melee">Ближний бой</button><button data-action="health">Применить урон</button><button data-action="death">Проверка смерти</button></div></div></div>`,
    cyber: RED.cyber,
    net: RED.net,
    gear: RED.gear,
    role: RED.rolePane,
    life: RED.life,
    journal: () =>
      `<div class="panel"><h2>Дневник</h2><label>Личная запись<textarea id="journal">${RED.escape(RED.state.notes)}</textarea></label><button class="primary section" data-action="save-note">Сохранить запись</button><p class="caption section">В макете запись хранится локально. В продукте действует видимость дневника.</p></div>`,
  };
  return `<div class="sheet-head row"><div class="avatar">ST</div><div><div class="eyebrow">Cyberpunk RED · 2045</div><h1>${RED.escape(RED.state.name)}</h1><p class="caption">${RED.role()[1]} · ранг 4 · Ночной рейс</p></div><div class="actions row"><span class="pill">Сессия · 3 игрока</span><button data-action="sheet-menu">Меню листа</button></div></div><div class="compact-resources"><button data-action="health">Здоровье<b>${RED.state.hp} / 40</b></button><button data-action="humanity">Человечность<b>${RED.state.humanity} / 60</b></button><button data-action="luck">Удача<b>${RED.state.luck} / 5</b></button></div><nav class="tabs" aria-label="Разделы листа">${RED.tabs.map(([id, title]) => `<button data-tab="${id}" aria-selected="${RED.state.tab === id}">${title}</button>`).join("")}</nav><div class="sheet-grid"><aside class="side stack">${RED.skillList(true)}</aside><main class="main-pane">${(content[RED.state.tab] || RED.base)()}</main><aside class="side stack">${RED.resources()}${RED.protection()}</aside></div>`;
};
