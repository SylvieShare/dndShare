package ru.dndshare.client.print

import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.character.creation.*
import ru.dndshare.client.model.*

data class CharacterPrintBlock(
    val title: String = "",
    val html: String = "",
    val values: List<Pair<String, String>> = emptyList(),
)

data class CharacterPrintContent(
    val name: String,
    val subtitle: String,
    val portrait: String?,
    val blocks: List<CharacterPrintBlock>,
)

fun characterPrintContent(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
): CharacterPrintContent {
    val values = sheet.values
    val blocks = buildList {
        fun text(title: String, html: String) {
            if (html.isNotBlank()) add(CharacterPrintBlock(title, html))
        }
        fun pairs(title: String, rows: List<Pair<String, String>>) {
            if (rows.isNotEmpty()) add(CharacterPrintBlock(title, values = rows))
        }
        if (sheet.templateName == "DND5") {
            val mechanics = DndDerivedValues(sheet, items, metadata)
            pairs(
                "Характеристики",
                creationStats.zip(statTitles).map { (id, title) ->
                    title to
                        "${mechanics.score(id)} (${signed(abilityModifier(mechanics.score(id)))})"
                },
            )
            pairs(
                "Спасброски",
                creationStats.zip(statTitles).mapIndexed { index, (id, title) ->
                    val row = values[id].objectValue()
                    val context = RuleContext(kind = "saving_throw", ability = index + 1L)
                    val proficient =
                        row["save_up"] == JsonPrimitive(true) ||
                            mechanics.rank("save_proficiency", context) > 0
                    title to
                        signed(
                            abilityModifier(mechanics.score(id)) +
                                (if (proficient) sheet.proficiency() else 0) +
                                row["save_bonuses"].bonusTotal() +
                                mechanics.bonus("save_bonus", context)
                        )
                },
            )
            val hp = values["hp"].objectValue()
            val initiative = values["initiative"].objectValue()
            pairs(
                "Бой",
                listOf(
                    "Хиты" to "${hp["current"].number()} / ${mechanics.hpMaximum()}",
                    "Временные хиты" to hp["temp"].number().toString(),
                    "Класс доспеха" to mechanics.armor.total.toString(),
                    "Инициатива" to
                        signed(
                            initiative["base"].number() +
                                initiative["bonuses"].bonusTotal() +
                                (if (initiative["use_dex"] == JsonPrimitive(false)) 0
                                else abilityModifier(mechanics.score("DEX")))
                        ),
                    "Скорость" to "${mechanics.speed()} футов",
                    "Бонус мастерства" to signed(sheet.proficiency()),
                    "Кости хитов" to
                        hp["hitDice"].arrayValue().joinToString(" · ") {
                            val row = it.objectValue()
                            "${row["total"].number()-row["used"].number()}/${row["total"].number()} ${row.text("die")}"
                        },
                    "Спасброски от смерти" to
                        "Успехи ${hp["ds_success"].number()} · провалы ${hp["ds_failure"].number()}",
                ),
            )
            pairs("Навыки", printSkillRows(sheet, items, metadata))
            pairs(
                "Владения и языки",
                values["proficiencies"].objectValue().map { (key, rows) ->
                    key to rows.arrayValue().joinToString(", ") { it.jsonPrimitive.content }
                },
            )
            pairs(
                "Состояния",
                values["states"].arrayValue().map { raw ->
                    val row = raw.objectValue()
                    (items[row["effect_id"].referenceId()]?.name
                        ?: row.text("name").ifBlank { "Состояние" }) to row.text("description")
                } +
                    if (values["exhaustion"].objectValue()["level"].number() > 0)
                        listOf(
                            "Истощение" to
                                values["exhaustion"].objectValue()["level"].number().toString()
                        )
                    else emptyList(),
            )
            pairs(
                "Ресурсы",
                resourceControls(sheet, items).map { it.title to "${it.value} / ${it.total}" },
            )
            pairs(
                "Защиты",
                sheetDefenses(sheet, items).map { row ->
                    mapOf(
                            "resistance" to "Сопротивление",
                            "immunity" to "Невосприимчивость",
                            "vulnerability" to "Уязвимость",
                        )[row.text("kind")]
                        .orEmpty() to
                        (metadata.suggests["12"]
                            .orEmpty()
                            .firstOrNull { it.id == row["damage_type"].referenceId() }
                            ?.value ?: row.text("damage_type"))
                },
            )
        } else {
            val labels =
                mapOf(
                    "nature" to "Натура",
                    "mask" to "Маска",
                    "clan" to "Клан",
                    "generation" to "Поколение",
                    "sire" to "Сир",
                    "persona" to "Амплуа",
                )
            pairs(
                "Персонаж",
                labels.mapNotNull { (key, title) ->
                    values.text(key).takeIf(String::isNotBlank)?.let { title to it }
                },
            )
            for ((title, fields) in vtmPointGroups) pairs(
                title,
                fields.map { (key, label) -> label to values[key].number().toString() },
            )
            for ((key, title) in
                listOf("disciplines" to "Дисциплины", "backgrounds" to "Предыстории")) pairs(
                title,
                values[key].arrayValue().map {
                    it.objectValue().let { row ->
                        row.text("name") to row["value"].number().toString()
                    }
                },
            )
            text("Слабость клана", values.text("clan_weakness"))
            pairs(
                "Здоровье",
                listOf(
                        "Царапина",
                        "Травма",
                        "Ранение",
                        "Тяжёлое ранение",
                        "Изуродован",
                        "Искалечен",
                        "Недееспособен",
                    )
                    .mapIndexed { index, label ->
                        label to
                            when (
                                (values["health"].arrayValue().getOrNull(index) as? JsonPrimitive)
                                    ?.content
                            ) {
                                "bashing" -> "Ушиб"
                                "lethal" -> "Летальный урон"
                                "aggravated" -> "Агравированный урон"
                                else -> "Нет повреждения"
                            }
                    },
            )
            pairs(
                "Опыт",
                listOf(
                    "Всего" to values["xp_total"].number().toString(),
                    "Потрачено" to values["xp_spent"].number().toString(),
                    "Доступно" to
                        (values["xp_total"].number() - values["xp_spent"].number()).toString(),
                ),
            )
            pairs(
                "Здоровье и ресурсы",
                listOf(
                    "Запас крови" to
                        values["blood_pool"].objectValue().let {
                            "${it["current"].number()} / ${it["max"].number(20)}"
                        },
                    "Сила воли" to values["willpower_temp"].number().toString(),
                    "Человечность" to values["humanity"].number().toString(),
                ),
            )
        }
        for ((key, title) in
            listOf(
                "abilities_class" to "Классовые способности",
                "abilities_race" to "Способности происхождения",
                "abilities_feats" to "Черты",
                "abilities_story" to "Сюжетные способности",
            )) {
            val entries = values[key].arrayValue()
            if (entries.isNotEmpty()) add(CharacterPrintBlock(title))
            for (raw in entries) {
                val row = raw.objectValue()
                val item = items[row.referenceId()]
                text(
                    item?.name ?: row.label().ifBlank { title },
                    item?.data?.text("desc").orEmpty().ifBlank {
                        item?.data?.text("description").orEmpty()
                    },
                )
                val choices = printChoiceLabels(row, item, items, metadata)
                pairs("Выборы", choices)
            }
        }
        fun inventory(title: String, rows: List<JsonElement>) {
            if (rows.isEmpty()) return
            pairs(
                title,
                rows.map { raw ->
                    val row = raw.objectValue()
                    val item = items[(row["magic_item_id"] ?: row["item_id"]).referenceId()]
                    val custom = row["override"].objectValue()
                    custom.text("name").ifBlank { item?.name ?: "Предмет" } to
                        "× ${row["count"].number(1)}"
                },
            )
            for (raw in rows) {
                val row = raw.objectValue()
                text(
                    row["override"].objectValue().text("name"),
                    row["override"].objectValue().text("desc"),
                )
            }
        }
        addAll(printWeaponBlocks(sheet, items, metadata))
        val bag = values["items"].objectValue()
        inventory("Экипировано", bag["equipped"].arrayValue())
        for (section in bag["sections"].arrayValue().map { it.objectValue() }) inventory(
            section.text("name").ifBlank { "Инвентарь" },
            section["items"].arrayValue(),
        )
        pairs(
            "Кошелёк",
            values["money"].objectValue()["amounts"].objectValue().map { (key, amount) ->
                (metadata.suggests["17"].orEmpty().firstOrNull { it.id.toString() == key }?.value
                    ?: if (sheet.templateName == "VTM20") "Доллары" else "Монеты $key") to
                    ((amount as? JsonPrimitive)?.longOrNull ?: 0L).toString()
            },
        )
        val spells = values["spells"].objectValue()
        pairs(
            "Ячейки",
            spells["slot_pools"].objectValue().flatMap { (pool, rows) ->
                rows.arrayValue().map { raw ->
                    val row = raw.objectValue()
                    "${if(pool=="short_rest")"Магия договора" else "Обычные"} · ${row["level"].number()} круг" to
                        "${row["total"].number()-row["used"].number()} / ${row["total"].number()}"
                }
            },
        )
        addAll(printSpellBlocks(sheet, items, metadata))
        val personality =
            linkedMapOf(
                "person_origin" to "Предыстория",
                "person_alignment" to "Мировоззрение",
                "person_appearance" to "Внешность",
                "person_age" to "Возраст",
                "person_height" to "Рост",
                "person_weight" to "Вес",
                "person_eyes" to "Глаза",
                "person_hair" to "Волосы",
                "person_skin" to "Кожа",
                "person_traits" to "Черты характера",
                "person_ideals" to "Идеалы",
                "person_bonds" to "Привязанности",
                "person_flaws" to "Слабости",
                "person_backstory" to "История",
                "person_allies" to "Союзники",
                "notes" to "Заметки",
            )
        personality.forEach { (key, title) -> text(title, values.text(key)) }
    }
    return CharacterPrintContent(
        sheet.name,
        listOf(sheet.sourceName, sheet.sourceVersion, sheet.subtitle())
            .filter(String::isNotBlank)
            .joinToString(" · "),
        sheet.portrait ?: sheet.iconImageUrl,
        blocks,
    )
}
