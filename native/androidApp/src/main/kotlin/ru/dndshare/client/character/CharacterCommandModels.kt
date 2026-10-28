package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

fun spellSlotOptions(
    sheet: CharacterSheet,
    spell: CatalogueItem,
    reference: JsonObject,
): List<JsonObject> {
    val base = spell.data["lvl"].number()
    if (reference["slotless"] == JsonPrimitive(true))
        return listOf(
            buildJsonObject {
                put("pool", "slotless")
                put("level", reference["cast_level"].number(base))
            }
        )
    if (base == 0)
        return listOf(
            buildJsonObject {
                put("pool", "cantrip")
                put("level", 0)
            }
        )
    return listOf("short_rest", "long_rest")
        .flatMap { pool ->
            sheet.values["spells"]
                .objectValue()["slot_pools"]
                .objectValue()[pool]
                .arrayValue()
                .mapNotNull { raw ->
                    val slot = raw.objectValue()
                    if (
                        slot["level"].number() < base ||
                            slot["used"].number() >= slot["total"].number()
                    )
                        null
                    else JsonObject(slot + ("pool" to JsonPrimitive(pool)))
                }
        }
        .sortedBy { it["level"].number() }
}

fun findSpellReference(sheet: CharacterSheet, key: String): JsonObject? {
    val book = sheet.values["spells"].objectValue()
    return (book["tabs"].arrayValue().flatMap { it.objectValue()["spells"].arrayValue() } +
            book["grants"].arrayValue())
        .map { it.objectValue() }
        .firstOrNull { it.text("key") == key }
}

fun spellCastingBlocked(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata = HandbookMetadata(),
): Boolean {
    val derived = DndDerivedValues(sheet, items, metadata)
    if (
        derived.armor.body?.let { !armorProficient(it, derived) } == true ||
            sheet.sourceVersion != "2024" &&
                derived.armor.shield?.let { !armorProficient(it, derived) } == true
    )
        return true
    return sheet.values["states"].arrayValue().any { raw ->
        val state = raw.objectValue()
        state["external_only"] != JsonPrimitive(true) &&
            items[state["effect_id"].referenceId()]
                ?.data
                ?.get("derived_effects")
                .arrayValue()
                .any { value ->
                    val rule = value.objectValue()
                    rule.text("kind") == "activity_block" &&
                        "spellcasting" in
                            rule["scopes"].arrayValue().map { it.jsonPrimitive.content }
                }
    }
}

fun spellCastIntent(
    sheet: CharacterSheet,
    input: JsonObject,
    items: Map<Long, CatalogueItem>,
    sessionUuid: String?,
    metadata: HandbookMetadata = HandbookMetadata(),
): JsonObject {
    val key = input.text("entryKey")
    val reference = findSpellReference(sheet, key) ?: error("Заклинания больше нет в книге.")
    val item =
        items[reference["id"].referenceId()]
            ?: error("Сначала загрузите заклинание из справочника.")
    require(!spellCastingBlocked(sheet, items, metadata)) {
        "Активный эффект или отсутствие владения доспехом запрещает сотворение заклинаний."
    }
    val base = item.data["lvl"].number()
    val level = input.text("castLevel").toIntOrNull() ?: base
    require(level in base..9) { "Выберите круг заклинания." }
    val spend =
        input["spendSlot"] == JsonPrimitive(true) &&
            base > 0 &&
            reference["slotless"] != JsonPrimitive(true)
    val pool = input.text("pool").ifBlank { "long_rest" }
    require(pool in setOf("long_rest", "short_rest", "cantrip", "slotless"))
    if (spend)
        require(
            spellSlotOptions(sheet, item, reference).any {
                it.text("pool") == pool && it["level"].number() == level
            }
        ) {
            "Нет свободной ячейки выбранного круга."
        }
    val creating = input.text("creationKey").isNotBlank()
    val targets =
        if (creating) listOf("self")
        else input["targets"].arrayValue().map { it.jsonPrimitive.content }.distinct()
    require(targets.size <= 50)
    val dm = if (creating) 0 else input.text("dmCount").toIntOrNull() ?: 0
    require(dm in 0..50)
    val count =
        if (input["createAll"] == JsonPrimitive(true)) 0
        else input.text("createdCount").toIntOrNull() ?: 0
    require(count in 0..999)
    if (creating) {
        val creation =
            item.data["item_creation"]
                .arrayValue()
                .map { it.objectValue() }
                .firstOrNull { it.text("key") == input.text("creationKey") }
                ?: error("Вариант создания предметов больше недоступен.")
        if (input["createAll"] == JsonPrimitive(false))
            require(count > 0) { "Укажите количество создаваемых предметов." }
        if (count > 0) {
            require(
                creation["choose_count"] == JsonPrimitive(true) &&
                    creation["outputs"].arrayValue().size == 1
            ) {
                "У этого варианта нельзя изменить количество."
            }
            val output = creation["outputs"].arrayValue().single().objectValue()
            val maximum =
                output["count"].number(1) +
                    (level - base).coerceAtLeast(0) /
                        output["scaling_step"].number(1).coerceAtLeast(1) *
                        output["per_slot"].number().coerceAtLeast(0)
            require(count <= maximum) { "Можно создать не больше $maximum." }
        }
    }
    val targetRule = item.data["application_targets"].objectValue()
    val manual = targets.isEmpty() && dm == 0 && !creating
    if (!manual && !creating) {
        val maximum =
            (targetRule["count"].number(1).coerceAtLeast(1).toLong() +
                    targetRule["per_slot"].number().coerceAtLeast(0).toLong() *
                        (level - base).coerceAtLeast(0))
                .coerceAtMost(50)
                .toInt()
        require(targets.size + dm <= maximum) { "Выберите не больше $maximum целей." }
        require(
            targetRule["self_only"] != JsonPrimitive(true) || targets == listOf("self") && dm == 0
        ) {
            "Это заклинание применяется только к себе."
        }
    }
    return buildJsonObject {
        put("manual", manual)
        put("spellId", item.id)
        put("entryKey", key)
        put("castLevel", level)
        put("pool", pool)
        put("spendSlot", spend)
        put("targets", JsonArray(targets.map(::JsonPrimitive)))
        put("dmCount", dm)
        put("optionKey", if (creating) "" else input.text("optionKey"))
        put("sessionUuid", sessionUuid.orEmpty())
        put("creationKey", input.text("creationKey"))
        put("createdCount", count)
    }
}

fun spellApplicationOptions(item: CatalogueItem): List<JsonObject> =
    item.data["status_effects"]
        .arrayValue()
        .map { it.objectValue() }
        .filter { it.text("apply_on") in setOf("", "any", "cast") }
