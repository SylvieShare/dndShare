package ru.dndshare.client.character

import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.model.CatalogueItem
import ru.dndshare.client.model.text

internal data class FeatureRule(
    val feature: OwnedFeature,
    val rule: JsonObject,
    val index: Int,
    val level: Int,
)

internal fun OwnedFeature.active(sheet: CharacterSheet, activation: String = ""): Boolean =
    item.typeId != 19L || magicActive(item, instance, equipped, sheet, activation)

internal fun OwnedFeature.activeRules(sheet: CharacterSheet, field: String) = sequence {
    val rules = item.data[field].arrayValue()
    if (rules.isEmpty()) return@sequence
    val level = ownerLevel(item.data, sheet)
    for ((index, raw) in rules.withIndex()) {
        val rule = raw as? JsonObject ?: continue
        if (level >= rule["level"].number(1).coerceAtLeast(1) && active(sheet, rule.text("activation")))
            yield(FeatureRule(this@activeRules, rule, index, level))
    }
}

internal fun ownedFeatureRules(sheet: CharacterSheet, items: Map<Long, CatalogueItem>, field: String) =
    ownedFeatures(sheet, items).asSequence().flatMap { it.activeRules(sheet, field) }
