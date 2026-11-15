RED.steps = [
  "Правила",
  "Роль",
  "Жизненный путь",
  "Характеристики",
  "Навыки",
  "Снаряжение",
  "Киберware",
  "Завершение",
];
RED.stepDescriptions = [
  "Выбери способ создания и доступные источники.",
  "От роли зависят особые возможности и твоя история.",
  "Связи и решения, которые привели тебя в Найт-Сити.",
  "Основа героя, до эффектов снаряжения и имплантов.",
  "Во что вложен опыт и какие задачи герой решает лучше.",
  "Всё необходимое для первой работы.",
  "Проверь совместимость и цену изменений.",
  "Последние штрихи и предпросмотр листа.",
];
RED.methods = [
  [
    "streetrat",
    "Быстрый старт",
    "Streetrat",
    "Готовые сочетания характеристик, навыков и вещей.",
  ],
  [
    "edgerunner",
    "Гибкий шаблон",
    "Edgerunner",
    "Броски по ролевым таблицам и выборы в пределах роли.",
  ],
  [
    "complete",
    "Полная настройка",
    "Complete Package",
    "Распредели характеристики, навыки и бюджет покупок.",
  ],
];
RED.wizardBody = () => {
  const s = RED.state,
    total = Object.values(s.stats).reduce((a, b) => a + b, 0);
  const pages = [
    () =>
      `<div class="panel section-heading"><div class="row between"><div><div class="eyebrow">Игровая система</div><h2>Cyberpunk RED</h2></div><span class="pill purple">Core · 2045</span></div><p class="muted">Основная книга с исправлениями. Источники дополнений выбираются отдельно.</p></div><div class="choice-grid">${RED.methods.map(([id, ru, en, desc]) => `<button class="choice" data-method="${id}" aria-pressed="${s.method === id}"><span class="role-code">${en}</span><h3>${ru}</h3><p>${desc}</p></button>`).join("")}</div><p class="note section">Этот макет показывает путь создания. Точные таблицы и бюджеты будут загружаться из сверенного профиля правил.</p>`,
    () =>
      `<div class="choice-grid">${RED.roles.map(([id, ru, en, ability, desc]) => `<button class="choice" data-role="${id}" aria-pressed="${s.role === id}"><span class="role-code">${en}</span><h3>${ru}</h3><p>${desc}</p><span class="pill">${ability}</span></button>`).join("")}</div><div class="panel section"><h3>${RED.role()[3]} · ранг 4</h3><p class="muted section">${RED.role()[4]}</p><button class="quiet section" data-action="role">Настройки роли →</button></div>`,
    () =>
      `<div class="field-grid"><label>Культурное происхождение<select><option>Европа</option><option>Восточная Азия</option><option>Северная Америка</option><option>Свой вариант</option></select></label><label>Окружение детства<select><option>Улицы города</option><option>Корпоративный район</option><option>Кочевой клан</option></select></label><label>Самый близкий человек<input value="Лина — подруга из мастерской"></label><label>Главная ценность<input value="Свобода и верность своим"></label></div><div class="panel section"><h2>Личный путь · ${RED.role()[1]}</h2><label>История<textarea data-draft="lifepath">${RED.escape(s.lifepath)}</textarea></label><p class="caption section">В полном визарде здесь появятся все поля общего пути и отдельная ветка выбранной роли.</p></div>`,
    () =>
      `<div class="budget ${total !== 62 ? "invalid" : ""}"><div><div class="caption">Демонстрационный бюджет</div><strong>${total} / 62</strong></div><div><b>${62 - total} осталось</b><p class="caption">Диапазон примера: 2–8</p></div></div>${s.method !== "complete" ? `<div class="note section-heading">Метод «${RED.methods.find((m) => m[0] === s.method)[1]}»: значения набора показаны для композиции. Генерация по ролевым таблицам подключается в реализации.</div>` : ""}<div class="field-grid">${RED.stats.map(([key, name]) => `<label class="stat-edit"><span><b>${name}</b><span class="caption"> · ${key}</span></span><input type="number" min="2" max="8" value="${s.stats[key]}" data-stat="${key}" ${s.method === "complete" ? "" : "disabled"}></label>`).join("")}</div><div id="stat-error" class="errors" role="alert">${total === 62 ? "" : "Распредели ровно 62 очка в демонстрационном профиле."}</div>`,
    () =>
      `<div class="budget"><div><span class="caption">Навыки и специализации</span><p><b>Ранг → база проверки</b></p></div><span class="pill">${RED.role()[1]}</span></div>${RED.skillList()}<div class="note section">Здесь показана выборка для макета. Финальный визард учитывает полный бюджет, минимумы, ×2, родной язык и ограничения метода.</div>`,
    () =>
      `<div class="budget"><div><div class="caption">Снаряжение и киберware · пример</div><strong>2 550 eb</strong></div><div><div class="caption">Одежда и fashionware</div><strong>800 eb</strong></div></div><div class="panel"><h2>${s.method === "complete" ? "Корзина" : "Комплект роли"}</h2>${[
        ["Тяжёлый пистолет", "Оружие"],
        ["Лёгкая бронекуртка", "Броня"],
        ["Базовые патроны", "Боеприпасы"],
        ["Агент", "Устройство"],
      ]
        .map(
          ([n, t]) =>
            `<div class="list-row"><div><b>${n}</b><p>${t}</p></div><button data-detail="${n}">Сведения</button></div>`,
        )
        .join(
          "",
        )}<button class="quiet section" data-action="catalog">+ Открыть подбор</button></div><p class="caption section">Суммы и комплекты здесь иллюстративны. Подтверждение покупки в продукте проверит отдельные бюджеты и ограничения.</p>`,
    () => RED.cyber(),
    () =>
      `<div class="field-grid"><label>Имя / handle<input data-draft="name" value="${RED.escape(s.name)}"></label><label>Роль<input value="${RED.role()[1]} · ранг 4" disabled></label></div><div class="review-grid section"><div class="panel"><h2>Твой герой</h2><p>${RED.methods.find((m) => m[0] === s.method)[1]}</p><div class="stat-grid">${RED.stats
        .slice(0, 5)
        .map(
          ([k]) =>
            `<div class="stat"><small>${k}</small><b>${s.stats[k]}</b></div>`,
        )
        .join(
          "",
        )}</div><button data-action="preview">Предпросмотр листа</button></div><div class="panel"><h2>Проверка перед созданием</h2><div class="checks"><div class="check"><span>✓</span> Роль выбрана</div><div class="check"><span>✓</span> Жизненный путь сохранён</div><div class="check"><span>${total === 62 ? "✓" : "!"}</span> Характеристики: ${total} / 62</div></div><p class="caption">Прототип создаёт только локальный демонстрационный лист.</p></div></div>`,
  ];
  return pages[s.step]();
};
RED.wizard = () =>
  `<div class="wizard-layout"><aside class="wizard-rail"><div class="row between section-heading"><h3>Создание</h3><button class="quiet" data-action="reset">Сброс</button></div><nav class="step-list" aria-label="Шаги создания">${RED.steps.map((title, i) => `<button class="step-button" data-step="${i}" ${i === RED.state.step ? 'aria-current="step"' : ""}><span class="step-number">${i < RED.state.step ? "✓" : i + 1}</span><div>${title}${i === 1 ? `<p class="caption">${RED.role()[1]}</p>` : ""}</div></button>`).join("")}</nav></aside><main class="wizard-main"><div class="wizard-mini row between"><span>Шаг ${RED.state.step + 1} из 8</span><button data-action="steps">Все шаги</button></div><div class="wizard-heading"><div class="eyebrow">Новый персонаж / Cyberpunk RED</div><h1>${RED.steps[RED.state.step]}</h1><p class="muted">${RED.stepDescriptions[RED.state.step]}</p></div><div class="wizard-body">${RED.wizardBody()}</div><div class="wizard-footer"><button data-action="prev" ${RED.state.step === 0 ? "disabled" : ""}>← Назад</button><button class="primary" data-action="next">${RED.state.step === 7 ? "Создать демо-персонажа" : "Далее →"}</button></div></main></div>`;
