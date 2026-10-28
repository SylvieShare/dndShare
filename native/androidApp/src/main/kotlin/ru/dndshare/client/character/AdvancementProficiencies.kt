package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.character.creation.*
import ru.dndshare.client.model.*

internal fun advancementProficiencies(
    plan: LevelAdvancement,
    values: MutableMap<String, JsonElement>,
) {
    val item = plan.charClass ?: return
    val proficiencies = values["proficiencies"].objectValue().toMutableMap()
    fun labels(bucket: String, labels: List<String>) {
        if (labels.isNotEmpty())
            proficiencies[bucket] =
                JsonArray(
                    (proficiencies[bucket].arrayValue() + labels.map(::JsonPrimitive)).distinct()
                )
    }
    if (plan.oldClass == null && plan.oldClasses.isNotEmpty()) {
        val key = item.nameEn.orEmpty().trim().lowercase()
        val grants = multiclassGrants[key].orEmpty()
        grants.forEach { (bucket, list) -> labels(bucket, list) }
        if (key in listOf("bard", "ranger", "rogue")) {
            val skill =
                plan.input["multiclassSkill"].referenceId() ?: error("Выберите навык мультикласса.")
            val allowed =
                item.data["skill_choice"].objectValue()["from"].arrayValue().mapNotNull {
                    it.referenceId()
                }
            require(key == "bard" || allowed.isEmpty() || skill in allowed) {
                "Выберите навык из списка класса."
            }
            val stat = skillStat(skill) ?: error("Неизвестный навык.")
            val block = values[stat].objectValue()
            val skills = block["skills"].objectValue()
            val saved = skills[skill.toString()].objectValue()
            require(saved["up"].number() == 0) { "Этим навыком персонаж уже владеет." }
            values[stat] =
                JsonObject(
                    block +
                        ("skills" to
                            JsonObject(
                                skills +
                                    (skill.toString() to
                                        JsonObject(saved + ("up" to JsonPrimitive(1))))
                            ))
                )
            if (key == "bard") {
                val tool =
                    plan.input["multiclassTool"].referenceId()
                        ?: error("Выберите музыкальный инструмент.")
                val label =
                    plan.metadata.suggests["5"].orEmpty().firstOrNull { it.id == tool }?.value
                        ?: error("Инструмент недоступен.")
                labels("Инструменты", listOf(label))
            }
        }
    }
    val oldSubclass = plan.oldClass?.get("subclass").referenceId()
    if (plan.subclassId != null && plan.subclassId != oldSubclass) {
        val data = plan.subclass?.data.objectValue()
        for ((field, bucket, type) in
            listOf(
                Triple("armor_prof", "Доспехи", "3"),
                Triple("weapon_prof", "Оружие", "4"),
                Triple("tool_prof", "Инструменты", "5"),
                Triple("languages", "Языки", "6"),
            )) {
            val ids = data[field].arrayValue().mapNotNull { it.referenceId() }
            labels(
                bucket,
                plan.metadata.suggests[type].orEmpty().filter { it.id in ids }.map { it.value },
            )
        }
    }
    if (proficiencies.isNotEmpty()) values["proficiencies"] = JsonObject(proficiencies)
}

private val multiclassGrants =
    mapOf(
        "barbarian" to
            mapOf(
                "Доспехи" to listOf("Щиты"),
                "Оружие" to listOf("Простое оружие", "Воинское оружие"),
            ),
        "bard" to mapOf("Доспехи" to listOf("Лёгкие доспехи")),
        "cleric" to mapOf("Доспехи" to listOf("Лёгкие доспехи", "Средние доспехи", "Щиты")),
        "druid" to mapOf("Доспехи" to listOf("Лёгкие доспехи", "Средние доспехи", "Щиты")),
        "fighter" to
            mapOf(
                "Доспехи" to listOf("Лёгкие доспехи", "Средние доспехи", "Щиты"),
                "Оружие" to listOf("Простое оружие", "Воинское оружие"),
            ),
        "monk" to mapOf("Оружие" to listOf("Простое оружие", "Короткие мечи")),
        "paladin" to
            mapOf(
                "Доспехи" to listOf("Лёгкие доспехи", "Средние доспехи", "Щиты"),
                "Оружие" to listOf("Простое оружие", "Воинское оружие"),
            ),
        "ranger" to
            mapOf(
                "Доспехи" to listOf("Лёгкие доспехи", "Средние доспехи", "Щиты"),
                "Оружие" to listOf("Простое оружие", "Воинское оружие"),
            ),
        "rogue" to
            mapOf(
                "Доспехи" to listOf("Лёгкие доспехи"),
                "Инструменты" to listOf("Воровские инструменты"),
            ),
        "warlock" to
            mapOf("Доспехи" to listOf("Лёгкие доспехи"), "Оружие" to listOf("Простое оружие")),
        "artificer" to
            mapOf(
                "Доспехи" to listOf("Лёгкие доспехи", "Средние доспехи", "Щиты"),
                "Инструменты" to listOf("Воровские инструменты", "Инструменты жестянщика"),
            ),
    )
