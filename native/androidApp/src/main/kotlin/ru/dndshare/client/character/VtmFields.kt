package ru.dndshare.client.character

val vtmPhysical =
    listOf("strength" to "Сила", "dexterity" to "Ловкость", "stamina" to "Выносливость")
val vtmSocial =
    listOf("charisma" to "Обаяние", "manipulation" to "Манипуляция", "appearance" to "Внешность")
val vtmMental =
    listOf("perception" to "Восприятие", "intelligence" to "Интеллект", "wits" to "Смекалка")
val vtmTalents =
    listOf(
        "athletics" to "Атлетика",
        "alertness" to "Бдительность",
        "brawl" to "Драка",
        "intimidation" to "Запугивание",
        "expression" to "Красноречие",
        "leadership" to "Лидерство",
        "streetwise" to "Уличное чутьё",
        "subterfuge" to "Хитрость",
        "dodge" to "Шестое чувство",
        "empathy" to "Эмпатия",
    )
val vtmSkills =
    listOf(
        "drive" to "Вождение",
        "security" to "Воровство",
        "survival" to "Выживание",
        "performance" to "Исполнение",
        "animal_ken" to "Обращение с животными",
        "crafts" to "Ремесло",
        "stealth" to "Скрытность",
        "firearms" to "Стрельба",
        "melee" to "Фехтование",
        "etiquette" to "Этикет",
    )
val vtmKnowledge =
    listOf(
        "linguistics" to "Гуманитарные науки",
        "academics" to "Естественные науки",
        "law" to "Законы",
        "computer" to "Информатика",
        "medicine" to "Медицина",
        "occult" to "Оккультизм",
        "politics" to "Политика",
        "investigation" to "Расследование",
        "finance" to "Финансы",
        "electronics" to "Электроника",
    )

val vtmPointGroups =
    listOf(
        "Физические" to vtmPhysical,
        "Социальные" to vtmSocial,
        "Ментальные" to vtmMental,
        "Таланты" to vtmTalents,
        "Навыки" to vtmSkills,
        "Знания" to vtmKnowledge,
        "Добродетели" to
            listOf(
                "conscience" to "Совесть / Решимость",
                "self_control" to "Самоконтроль / Инстинкты",
                "courage" to "Смелость",
            ),
        "Человечность и сила воли" to
            listOf(
                "humanity" to "Человечность",
                "willpower_perm" to "Постоянная",
                "willpower_temp" to "Временная",
            ),
    )
