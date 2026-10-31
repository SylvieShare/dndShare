package ru.dndshare.client.ui

import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.Glyph

internal data class CoverValue(
    val label: String,
    val value: String,
    val note: String = "",
    val glyph: Glyph? = null,
    val dawn: Boolean = false,
)

internal data class CatalogueSummary(
    val left: List<CoverValue> = emptyList(),
    val right: List<CoverValue> = emptyList(),
    val rail: List<CoverValue> = emptyList(),
    val keys: Set<String> = emptySet(),
    val kind: String = "",
)

internal fun catalogueSummary(
    item: CatalogueItem,
    type: ItemType?,
    metadata: HandbookMetadata,
    instance: JsonObject? = null,
): CatalogueSummary {
    val d = item.data
    fun value(key: String) =
        d[key]
            ?.let { raw ->
                val field =
                    (type?.fields as? JsonArray)?.filterIsInstance<JsonObject>()?.firstOrNull {
                        it.text("key") == key
                    }
                if (field != null) readableValue(raw, field, metadata)
                else if (raw is JsonPrimitive) raw.contentOrNull.orEmpty() else ""
            }
            .orEmpty()
    val economy = buildList {
        catalogueCost(d["cost"], metadata).takeIf(String::isNotBlank)?.let {
            add(CoverValue("Стоимость", it))
        }
        value("weight").takeIf(String::isNotBlank)?.let { add(CoverValue("Вес", it, "фунт.")) }
    }
    fun names(key: String, typeId: Long) =
        d[key].arrayValue().mapNotNull { raw ->
            if (raw is JsonObject)
                raw.text("value").ifBlank { raw.text("name") }.takeIf(String::isNotBlank)
            else raw.referenceId()?.let { metadata.suggest(it, typeId)?.value }
        }
    return when (item.typeId) {
        1L -> {
            fun damage(key: String): CoverValue? {
                val row = d[key].arrayValue().firstOrNull().objectValue()
                if (row.isEmpty()) return null
                val raw = row.text("dice_id")
                val die =
                    metadata.suggests["1"].orEmpty().firstOrNull { it.id.toString() == raw }?.value
                        ?: raw
                val count = row["count"].number(1)
                val formula =
                    if (die.isBlank()) count.toString() else "$count${die.replace("d","к") }"
                return CoverValue(
                    if (key == "attacks") "Урон" else "Двумя руками",
                    formula,
                    metadata.suggest(row["type"].referenceId() ?: 0, 12)?.value.orEmpty(),
                )
            }
            CatalogueSummary(
                buildList {
                    damage("attacks")?.let(::add)
                    damage("universe_attacks")?.let(::add)
                    add(
                        CoverValue(
                            "Категория",
                            if (d["is_military"] == JsonPrimitive(true)) "Воинское"
                            else if (item.name == "Безоружный удар") "Без оружия" else "Простое",
                            if (d["is_long_range"] == JsonPrimitive(true)) "Дальнобойное"
                            else "Ближний бой",
                        )
                    )
                },
                buildList {
                    val range =
                        listOf(value("range_min"), value("range_max"))
                            .filter(String::isNotBlank)
                            .distinct()
                            .joinToString("/")
                    if (range.isNotBlank()) add(CoverValue("Дистанция", "$range фт."))
                    value("mastery").takeIf(String::isNotBlank)?.let {
                        add(CoverValue("Искусность", it, glyph = Glyph.Swords))
                    }
                    addAll(economy)
                },
                listOf(
                    CoverValue(
                        "Подходящее владение · любое",
                        names("required_weapon_proficiencies", 4).joinToString(" или ").ifBlank {
                            "Владеют все"
                        },
                    ),
                    CoverValue(
                        "Свойства",
                        names("tags", 14).joinToString(" · ").ifBlank { "Нет особых свойств" },
                    ),
                ),
                setOf(
                    "attacks",
                    "universe_attacks",
                    "mastery",
                    "is_military",
                    "is_long_range",
                    "range_min",
                    "range_max",
                    "cost",
                    "weight",
                    "tags",
                    "required_weapon_proficiencies",
                ),
            )
        }
        5L -> {
            val stats = itemStats(type, item, metadata)
            val casting =
                stats
                    .filter { it.label !in setOf("Уровень", "Школа") }
                    .map {
                        CoverValue(
                            it.label,
                            it.value,
                            if (it.label == "Время") d["time"].objectValue().text("condition")
                            else "",
                        )
                    }
                    .toMutableList()
            val components = d["components"].objectValue()
            val material = components["m"]?.jsonPrimitive?.contentOrNull.orEmpty()
            val signs =
                listOf("v" to "В", "s" to "С", "m" to "М")
                    .filter { (key, _) ->
                        components[key]?.jsonPrimitive?.booleanOrNull == true ||
                            key == "m" && material !in setOf("", "false")
                    }
                    .joinToString(" · ") { it.second }
            casting.removeAll { it.label == "Компоненты" }
            if (signs.isNotBlank()) casting += CoverValue("Компоненты", signs)
            val duration = d["duration"].objectValue()
            if (duration.isNotEmpty() && casting.none { it.label == "Длительность" }) {
                val text =
                    when (duration.text("kind")) {
                        "instant" -> "Мгновенная"
                        "permanent" -> "Постоянная"
                        "special" -> duration.text("text")
                        else ->
                            (duration.text("value") +
                                    " " +
                                    mapOf(
                                            "rounds" to "раунд.",
                                            "minutes" to "мин.",
                                            "hours" to "ч.",
                                            "days" to "дн.",
                                        )[duration.text("kind")]
                                        .orEmpty())
                                .trim()
                    }
                if (text.isNotBlank()) casting += CoverValue("Длительность", text)
            }
            val kind = buildList {
                stats
                    .filter { it.label in setOf("Уровень", "Школа") }
                    .forEach {
                        add(
                            if (it.label == "Уровень" && it.value != "Заговор")
                                "${it.value} уровень"
                            else it.value
                        )
                    }
                if (d["concentration"] == JsonPrimitive(true)) add("Концентрация")
                if (d["ritual"] == JsonPrimitive(true)) add("Ритуал")
            }
                .joinToString(" · ")
            CatalogueSummary(
                casting.take(2),
                casting.drop(2),
                keys =
                    setOf(
                        "lvl",
                        "schoolId",
                        "time",
                        "range",
                        "duration",
                        "concentration",
                        "ritual",
                    ),
                kind = kind,
            )
        }
        19L -> magicCatalogueSummary(item, metadata, instance)
        2L,
        12L,
        13L,
        14L,
        15L,
        6L,
        8L,
        9L,
        16L,
        17L -> {
            val stats =
                itemStats(type, item, metadata)
                    .filter { it.value.isNotBlank() }
                    .map { CoverValue(it.label, it.value) }
            CatalogueSummary(stats.take(3), stats.drop(3).take(3))
        }
        else -> CatalogueSummary()
    }
}

internal fun catalogueCoverHeight(typeId: Long, width: Float, ratio: Float?): Float {
    val defaultRatio =
        when (typeId) {
            1L,
            6L,
            12L -> 4f / 3
            2L,
            8L,
            9L,
            11L,
            13L,
            14L,
            16L,
            17L,
            19L -> 1.5f
            15L -> 4f
            else -> 2.5f
        }
    val minimum =
        when (typeId) {
            1L,
            12L -> 420f
            6L -> 440f
            5L -> 300f
            2L,
            14L,
            13L -> 400f
            15L -> 320f
            8L,
            9L,
            16L,
            17L -> 410f
            else -> 160f
        }
    return maxOf(minimum, width / (ratio?.takeIf { it > 0 } ?: defaultRatio))
}
