RED.catalog = () =>
  `<div class="catalog-header"><div class="eyebrow">Cyberpunk RED / Core</div><div class="row between section"><div><h1>Справочник</h1><p class="muted">Всё для персонажа и игровой сессии</p></div><input placeholder="Название или английский термин…" aria-label="Поиск коллекции" data-catalog-search></div></div><h2 class="section-heading">Персонаж и возможности</h2><div class="catalog-grid">${[
    ["Роли", "10", "Способности и развитие"],
    ["Навыки", "STAT + LVL", "Проверки и специализации"],
    ["Киберware", "Слоты", "Основания и опции"],
    ["Оружие", "d10", "Режимы, урон и боеприпасы"],
    ["Броня", "SP", "Защита и износ"],
    ["Снаряжение", "eb", "Предметы и устройства"],
    ["Сеть", "Interface", "Деки, программы и архитектуры"],
    ["Здоровье", "HP", "Ранения, травмы и лечение"],
    ["Жизнь в городе", "2045", "Жильё, работа, услуги"],
  ]
    .map(
      ([n, count, d]) =>
        `<button class="catalog-card" data-collection="${n}"><h3>${n}</h3><div class="count">${count}</div><p>${d}</p></button>`,
    )
    .join(
      "",
    )}</div><div class="panel section"><h2>Словари</h2><div class="row wrap">${["Характеристики", "Группы навыков", "Боеприпасы", "Категории цен", "Типы киберware", "Действия"].map((n) => `<button data-detail="${n}">${n}</button>`).join("")}</div></div><p class="caption section">Макет структуры. Количество записей появится после сверки и импорта полного каталога.</p>`;
RED.render = () => {
  document.getElementById("app").innerHTML =
    `<header class="app-header"><div class="app-logo">dnd<span>Share</span></div><span class="pill">Cyberpunk · RED</span><nav class="topnav" aria-label="Раздел приложения">${[
      ["sheet", "Лист"],
      ["wizard", "Создание"],
      ["catalog", "Справочник"],
    ]
      .map(
        ([v, l]) =>
          `<button data-view="${v}" aria-pressed="${RED.state.view === v}">${l}</button>`,
      )
      .join(
        "",
      )}</nav><div class="user-icon">Н</div></header><div class="demo-strip">Проект интерфейса · демонстрационные данные · локальный черновик</div><div class="workspace">${RED.state.view === "wizard" ? RED.wizard() : RED.state.view === "catalog" ? RED.catalog() : RED.sheet()}</div>`;
  RED.save();
};
RED.editNumber = (key, title, max) => {
  RED.modal(
    `<h2>${title}</h2><label>Текущее значение<input id="resource-input" type="number" min="0" ${max !== undefined ? `max="${max}"` : ""} value="${RED.state[key]}"></label><p class="caption section">Демонстрационное редактирование ресурса</p><button class="primary" id="resource-save">Сохранить</button>`,
  );
  document.getElementById("resource-save").onclick = () => {
    const v = Number(document.getElementById("resource-input").value);
    if (!Number.isFinite(v) || v < 0 || (max !== undefined && v > max)) {
      RED.toast("Проверь допустимый диапазон");
      return;
    }
    RED.state[key] = v;
    document.getElementById("dialog").close();
    RED.render();
  };
};
RED.roll = (name, base) => {
  RED.modal(
    `<h2>${RED.escape(name)}</h2><div class="budget"><span>Формула</span><strong>d10 + ${base}</strong></div><div class="two"><label>DV<input id="roll-dv" type="number" value="15"></label><label>Потратить LUCK<input id="roll-luck" type="number" min="0" max="${RED.state.luck}" value="0"></label></div><p class="caption section">Локальный демонстрационный бросок. Ресурс и событие сессии не изменяются.</p><button class="primary" id="roll-submit">Бросить d10</button><div id="roll-output" aria-live="polite"></div>`,
  );
  document.getElementById("roll-submit").onclick = () => {
    const luck = Number(document.getElementById("roll-luck").value),
      dv = Number(document.getElementById("roll-dv").value);
    if (!Number.isInteger(luck) || luck < 0 || luck > RED.state.luck) {
      RED.toast("Недопустимый расход удачи");
      return;
    }
    const d = 1 + Math.floor(Math.random() * 10),
      extra = d === 1 || d === 10 ? 1 + Math.floor(Math.random() * 10) : 0,
      score = base + d + (d === 1 ? -extra : extra) + luck;
    document.getElementById("roll-output").innerHTML =
      `<div class="roll-result">${score}</div><p class="muted">${base} + ${d}${extra ? ` ${d === 1 ? "−" : "+"} ${extra}` : ""} + ${luck} LUCK</p><p class="section">${score > dv ? "Успех" : "DV не превышена"} · DV ${dv}</p>`;
  };
};
RED.details = (title) =>
  RED.modal(
    `<h2>${RED.escape(title)}</h2><p class="muted">Карточка справочника</p><div class="panel section"><p>Краткая игровая справка, структурированные параметры, условия применения и ссылка на страницу источника.</p></div><div class="row wrap section"><span class="pill">Cyberpunk RED</span><span class="pill">Core Rulebook</span></div><p class="caption section">Демонстрация карточки. Полные данные будут добавлены после сверки источника.</p>`,
  );
document.addEventListener("click", (event) => {
  const b = event.target.closest("button");
  if (!b) return;
  if (b.dataset.view) {
    RED.state.view = b.dataset.view;
    RED.render();
    return;
  }
  if (b.dataset.tab) {
    RED.state.tab = b.dataset.tab;
    RED.render();
    return;
  }
  if (b.dataset.step !== undefined) {
    RED.state.step = Number(b.dataset.step);
    document.getElementById("dialog").close();
    RED.render();
    window.scrollTo(0, 0);
    return;
  }
  if (b.dataset.role) {
    RED.state.role = b.dataset.role;
    RED.render();
    return;
  }
  if (b.dataset.method) {
    RED.state.method = b.dataset.method;
    RED.render();
    return;
  }
  if (b.dataset.roll) {
    RED.roll(b.dataset.roll, Number(b.dataset.base));
    return;
  }
  if (b.dataset.detail) {
    RED.details(b.dataset.detail);
    return;
  }
  if (b.dataset.collection) {
    if (b.dataset.collection === "Роли") {
      RED.modal(
        `<h2>Все роли</h2>${RED.roles.map((r) => `<div class="list-row"><div><b>${r[1]}</b><p>${r[2]} · ${r[3]}</p></div></div>`).join("")}`,
      );
    } else RED.details(b.dataset.collection);
    return;
  }
  const a = b.dataset.action;
  if (a === "health") return RED.editNumber("hp", "Здоровье", 40);
  if (a === "humanity") return RED.editNumber("humanity", "Человечность", 60);
  if (a === "luck") return RED.editNumber("luck", "Удача", 5);
  if (a === "money") return RED.editNumber("cash", "Кошелёк · евробаксы");
  if (a === "reload") {
    RED.state.ammo = 8;
    RED.render();
    RED.toast("Демо-магазин заполнен");
    return;
  }
  if (a === "save-note") {
    RED.state.notes = document.getElementById("journal").value;
    RED.save();
    RED.toast("Запись сохранена в макете");
    return;
  }
  if (a === "catalog") {
    RED.state.view = "catalog";
    RED.render();
    return;
  }
  if (a === "preview") {
    RED.state.view = "sheet";
    RED.state.tab = "base";
    RED.render();
    return;
  }
  if (a === "steps") {
    RED.modal(
      `<h2>Шаги создания</h2><div class="stack">${RED.steps.map((x, i) => `<button data-step="${i}">${i + 1}. ${x}</button>`).join("")}</div>`,
    );
    return;
  }
  if (a === "reset") {
    RED.modal(
      '<h2>Сбросить демо-черновик?</h2><p>Будут восстановлены первоначальные примеры.</p><button class="primary" id="confirm-reset">Сбросить</button>',
    );
    document.getElementById("confirm-reset").onclick = () => {
      RED.state = JSON.parse(JSON.stringify(RED.defaultState));
      RED.state.view = "wizard";
      document.getElementById("dialog").close();
      RED.render();
    };
    return;
  }
  if (a === "prev") {
    RED.state.step = Math.max(0, RED.state.step - 1);
    RED.render();
    window.scrollTo(0, 0);
    return;
  }
  if (a === "next") {
    if (
      RED.state.step === 3 &&
      Object.values(RED.state.stats).reduce((x, y) => x + y, 0) !== 62
    ) {
      RED.toast("Распредели 62 очка в демонстрационном профиле");
      return;
    }
    if (RED.state.step === 7) {
      if (!RED.state.name.trim()) {
        RED.toast("Укажи имя персонажа");
        return;
      }
      RED.state.draftDone = true;
      RED.state.view = "sheet";
      RED.state.tab = "base";
      RED.toast("Демонстрационный лист готов");
    } else RED.state.step++;
    RED.render();
    window.scrollTo(0, 0);
    return;
  }
  if (a === "life") {
    RED.modal(
      `<h2>История персонажа</h2><label>Жизненный путь<textarea id="life-edit">${RED.escape(RED.state.lifepath)}</textarea></label><button class="primary" id="save-life">Сохранить</button>`,
    );
    document.getElementById("save-life").onclick = () => {
      RED.state.lifepath = document.getElementById("life-edit").value;
      document.getElementById("dialog").close();
      RED.render();
    };
    return;
  }
  if (a === "install") {
    RED.modal(
      '<h2>Установка киберware</h2><div class="modal-grid"><label>Основание<select><option>Нейронная связь · свободно 3</option><option>Новое основание</option></select></label><label>Опция<select><option>Выбрать из справочника</option></select></label><p class="note">Перед установкой показываем цену, требования, занятые слоты, потерю Humanity и итоговую EMP.</p><p class="caption">Пример состояния подбора; данные и проверки подключаются в реализации.</p></div>',
    );
    return;
  }
  if (a === "role") {
    RED.modal(
      `<h2>${RED.role()[3]}</h2><p>${RED.role()[4]}</p><label class="section">Ранг<input type="number" min="1" max="10" value="4"></label><p class="caption section">Здесь — настройки и выборы способности ${RED.role()[2]}. Их состав определяется схемой роли.</p>`,
    );
    return;
  }
  const labels = {
    armor: "Броня и износ",
    weapon: "Оружие и режимы",
    implant: "Киберимплант",
    programs: "Загруженные программы",
    netaction: "NET-действия",
    advance: "Развитие и IP",
    container: "Контейнер",
    expenses: "Жильё и расходы",
    melee: "Ближний бой",
    death: "Проверка смерти",
    "sheet-menu": "Действия листа",
  };
  if (labels[a]) RED.details(labels[a]);
});
document.addEventListener("input", (event) => {
  const el = event.target;
  if (el.hasAttribute("data-skill-search")) {
    const q = el.value.toLowerCase();
    document
      .querySelectorAll("[data-skill-name]")
      .forEach((n) => (n.hidden = !n.dataset.skillName.includes(q)));
  }
  if (el.hasAttribute("data-catalog-search")) {
    const q = el.value.toLowerCase();
    document
      .querySelectorAll("[data-collection]")
      .forEach(
        (n) => (n.hidden = !n.dataset.collection.toLowerCase().includes(q)),
      );
  }
  if (el.dataset.draft) {
    RED.state[el.dataset.draft] = el.value;
    RED.save();
  }
});
document.addEventListener("change", (event) => {
  const el = event.target;
  if (el.dataset.stat) {
    const n = Number(el.value);
    if (!Number.isInteger(n) || n < 2 || n > 8) {
      RED.toast("Значение должно быть от 2 до 8");
      el.value = RED.state.stats[el.dataset.stat];
      return;
    }
    RED.state.stats[el.dataset.stat] = n;
    RED.render();
  }
});
const params = new URLSearchParams(location.search);
if (params.has("view")) RED.state.view = params.get("view");
if (params.has("step"))
  RED.state.step = Math.max(0, Math.min(7, Number(params.get("step")) || 0));
RED.render();
