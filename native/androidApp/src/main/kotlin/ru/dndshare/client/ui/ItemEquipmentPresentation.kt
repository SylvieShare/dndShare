package ru.dndshare.client.ui

import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.Glyph

/** Prices are amounts in coin suggest type 17; IDs are never searched in unrelated dictionaries. */
internal fun catalogueCost(raw: JsonElement?, metadata: HandbookMetadata): String {
    val cost = raw as? JsonObject ?: return ""
    fun amount(key: String): String? =
        cost[key]
            ?.let { it as? JsonPrimitive }
            ?.contentOrNull
            ?.takeIf { it.toDoubleOrNull()?.let { n -> n.isFinite() && n >= 0 } == true }
    val exact = amount("value")
    val min = amount("min")
    val max = amount("max")
    val range =
        if (min != null && max != null && min.toDouble() <= max.toDouble())
            if (min.toDouble() == max.toDouble()) min else "$min–$max"
        else null
    val coin =
        metadata
            .suggest(cost["suggest_id"].referenceId() ?: 0, 17)
            ?.let { it.code?.takeIf(String::isNotBlank) ?: it.value }
            .orEmpty()
    fun withCoin(value: String) = listOf(value, coin).filter(String::isNotBlank).joinToString(" ")
    return when {
        exact != null && range != null -> "${withCoin(exact)} · диапазон ${withCoin(range)}"
        exact != null -> withCoin(exact)
        range != null -> withCoin(range)
        else -> ""
    }
}

internal fun magicCatalogueSummary(
    item: CatalogueItem,
    metadata: HandbookMetadata,
    instance: JsonObject?,
): CatalogueSummary {
    val d = item.data
    val state = instance?.get("params").objectValue()["magic"].objectValue()
    val lost = state["lost"] == JsonPrimitive(true)
    val kind = d.text("type").ifBlank { "Магический предмет" }
    val glyph =
        when (kind.lowercase()) {
            "оружие" -> Glyph.Swords
            "доспех",
            "щит" -> Glyph.ShieldCheck
            "амулет",
            "кольцо" -> Glyph.Gem
            "свиток" -> Glyph.Sessions
            else -> Glyph.Wand
        }
    val rarity =
        listOf("Обычный", "Необычный", "Редкий", "Очень редкий", "Легендарный", "Артефакт")
            .getOrNull(d["rarity"].number(-1)) ?: "Редкость не указана"
    val bonus =
        (d["weapon"].objectValue()["magic_bonus"] ?: d["armor_base"].objectValue()["magic_bonus"])
            .number()
    val left = buildList {
        add(CoverValue("Вид предмета", kind, glyph = glyph))
        add(CoverValue("Редкость", rarity, glyph = Glyph.Gem))
        if (!lost && bonus != 0)
            add(
                CoverValue(
                    "Магический бонус",
                    signed(bonus),
                    if (d["weapon"] is JsonObject) "к атаке и урону" else "к КД",
                    if (d["weapon"] is JsonObject) Glyph.Swords else Glyph.ShieldCheck,
                )
            )
    }
    val right = buildList {
        catalogueCost(d["cost"], metadata).takeIf(String::isNotBlank)?.let {
            add(CoverValue("Стоимость", it))
        }
        d["weight"]
            ?.takeUnless { it is JsonNull }
            ?.let { add(CoverValue("Вес", "${d.text("weight")} фунт.")) }
        if (!lost) {
            val initial = d["initial_charges"].objectValue()
            val total = state["max_use"]?.jsonPrimitive?.intOrNull
            val charges =
                when {
                    initial.isNotEmpty() && total != null && total in 0..100 ->
                        "${state["remaining"]?.jsonPrimitive?.intOrNull ?: total} / $total"
                    initial.isNotEmpty() ->
                        if (initial.text("mode") == "roll") initial.text("formula")
                        else initial.text("value")
                    d["manual_size"] == JsonPrimitive(true) -> "Задаёт владелец"
                    else -> d.text("max_use")
                }
            if (charges.isNotBlank())
                add(
                    CoverValue(
                        "Зарядов",
                        charges,
                        glyph = Glyph.Zap,
                        dawn = d["dawn_recovery"] != null && d["dawn_recovery"] !is JsonNull,
                    )
                )
            d["use_resources"].arrayValue().forEach { raw ->
                val resource = raw.objectValue()
                val key = resource.text("key")
                val initialResource = resource["initial_charges"].objectValue()
                val totalResource =
                    if (initialResource.isNotEmpty()) state["resource_maxima"].objectValue()[key]
                    else resource["max_use"]
                val value =
                    if (instance != null && totalResource != null)
                        "${state["resource_counts"].objectValue()[key] ?: totalResource} / $totalResource"
                    else if (initialResource.isNotEmpty())
                        initialResource.text(
                            if (initialResource.text("mode") == "roll") "formula" else "value"
                        )
                    else (totalResource as? JsonPrimitive)?.contentOrNull.orEmpty()
                if (value.isNotBlank())
                    add(
                        CoverValue(
                            resource.text("title").ifBlank { key },
                            value,
                            glyph = Glyph.Zap,
                            dawn =
                                resource["dawn_recovery"] != null &&
                                    resource["dawn_recovery"] !is JsonNull,
                        )
                    )
            }
        }
    }
    val rail =
        if (lost)
            listOf(
                CoverValue(
                    "Состояние экземпляра",
                    "Магические свойства утрачены · действует только основа",
                    glyph = Glyph.Wand,
                )
            )
        else
            listOf(
                CoverValue(
                    "Настройка",
                    when (d.text("attunement")) {
                        "none" -> "Без настройки"
                        "required" -> "Требует настройки"
                        else -> "Настройку нужно уточнить"
                    } +
                        d.text("attunement_requirement")
                            .takeIf(String::isNotBlank)
                            ?.let { " · $it" }
                            .orEmpty(),
                    glyph = Glyph.Link,
                ),
                CoverValue(
                    "Свойства действуют",
                    (if (d.text("activation") == "carried") "В инвентаре" else "При экипировке") +
                        if (d["level"].number(1) > 1) " · с уровня ${d["level"].number()}" else "",
                    glyph = if (d.text("activation") == "carried") Glyph.Backpack else Glyph.Hand,
                ),
            )
    return CatalogueSummary(
        left,
        right,
        rail,
        setOf(
            "type",
            "rarity",
            "cost",
            "weight",
            "max_use",
            "initial_charges",
            "manual_size",
            "attunement",
            "attunement_requirement",
            "activation",
            "dawn_recovery",
            "use_resources",
            "level",
        ),
    )
}

internal fun selectedEquipmentBases(
    item: CatalogueItem,
    instance: JsonObject?,
): List<Pair<String, Long>> {
    if (instance == null) return emptyList()
    val params = instance["params"].objectValue()
    return listOfNotNull(
        if (item.data["weapon"] is JsonObject)
            (if (instance["magic_item_id"].referenceId() != null) instance["item_id"].referenceId()
                else
                    params["weapon_base_item_id"].referenceId()
                        ?: item.data["weapon"].objectValue()["base_item_id"].referenceId())
                ?.let { "weapon" to it }
        else null,
        if (item.data["armor_base"] is JsonObject)
            (item.data["armor_base"].objectValue()["base_item_id"].referenceId()
                    ?: params["armor_base_item_id"].referenceId())
                ?.let { "armor_base" to it }
        else null,
    )
}

internal fun catalogueDieSides(raw: JsonElement?, metadata: HandbookMetadata): Int? {
    val primitive = raw as? JsonPrimitive ?: return null
    val label =
        primitive.longOrNull?.let { metadata.suggest(it, 1)?.value }
            ?: primitive.contentOrNull.orEmpty()
    val sides =
        Regex("(?:[0-9]+)?[dк]([0-9]+)", RegexOption.IGNORE_CASE)
            .matchEntire(label)
            ?.groupValues
            ?.get(1)
            ?.toIntOrNull()
    return sides?.takeIf { it in setOf(4, 6, 8, 10, 12, 20, 100) }
}
