package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

data class FeatureWidget(
    val key: String,
    val stateKey: String,
    val feature: OwnedFeature,
    val definition: JsonObject,
    val value: String,
    val active: Boolean,
    val resource: ResourceControl?,
    val unlimited: Boolean,
    val link: JsonObject?,
    val unavailable: String = "",
    val notes: List<FeatureWidget> = emptyList(),
) {
    val title
        get() = definition.text("title").ifBlank { feature.item.name }

    val kind
        get() = definition.text("kind").ifBlank { "metric" }
}

fun featureWidgets(sheet: CharacterSheet, items: Map<Long, CatalogueItem>): List<FeatureWidget> {
    val resources = resourceControls(sheet, items)
    val parts = buildList {
        for (feature in ownedFeatures(sheet, items)) {
            if (
                feature.item.typeId == 19L &&
                    !magicActive(feature.item, feature.instance, feature.equipped, sheet)
            )
                continue
            val level = ownerLevel(feature.item.data, sheet)
            val scaling =
                feature.item.data["scaling"]
                    .arrayValue()
                    .map { it.objectValue() }
                    .filter { it["level"].number() <= level }
                    .maxByOrNull { it["level"].number() }
            for ((index, raw) in feature.item.data["sheet_widgets"].arrayValue().withIndex()) {
                val definition = raw.objectValue()
                if (level > 0 && level < definition["level"].number(1)) continue
                val stateKey =
                    definition.text("key").ifBlank {
                        "${feature.key}:${featureEntryKey(feature)}:$index"
                    }
                val key =
                    if (feature.key == "magic_items") "magic:${featureEntryKey(feature)}:$stateKey"
                    else stateKey
                val prefix = "abilities:${feature.key}:${featureEntryKey(feature)}"
                val resourceKey = definition.text("resource_key")
                val resource =
                    if (level == 0) null
                    else
                        resources.firstOrNull { resource ->
                            if (resourceKey.isBlank())
                                resource.key == prefix || resource.key.startsWith("$prefix:")
                            else resource.key == "$prefix:$resourceKey"
                        }
                val link =
                    statusEffectLinks(feature.item).firstOrNull {
                        it.text("target") != "other" &&
                            it.text("key") == definition.text("status_effect_key")
                    }
                val active =
                    if (link != null) {
                        if (feature.key == "magic_items") linkedStatusActive(sheet, feature, link)
                        else
                            sheet.values["states"].arrayValue().any {
                                it.objectValue()["effect_id"].referenceId() == statusEffectId(link)
                            }
                    } else
                        feature.entry["widget_states"].objectValue()[stateKey] ==
                            JsonPrimitive(true)
                var unavailable = if (level == 0) "Нет нужного класса" else ""
                val value =
                    if (level == 0) ""
                    else
                        when (definition.text("value_source")) {
                            "scaling" -> scaling?.text("value").orEmpty()
                            "weapon_damage" -> {
                                val rule =
                                    feature.item.data["weapon_damage"]
                                        .arrayValue()
                                        .map { it.objectValue() }
                                        .firstOrNull {
                                            it.text("key") == definition.text("weapon_damage_key")
                                        }
                                when {
                                    rule == null -> {
                                        unavailable = "Правило урона не выбрано или удалено"
                                        ""
                                    }
                                    level < rule["level"].number(1) -> ""
                                    else ->
                                        "${weaponDamageDiceCount(rule,level)}${rule.text("dice").replace('d','к')}"
                                }
                            }
                            else -> definition.text("value")
                        }
                add(
                    FeatureWidget(
                        key,
                        stateKey,
                        feature,
                        definition,
                        value,
                        active,
                        resource,
                        definition.text("kind") == "toggle" &&
                            resource == null &&
                            scaling?.get("uses") == JsonPrimitive(0),
                        link,
                        unavailable,
                    )
                )
            }
        }
    }
    val grouped = linkedMapOf<String, FeatureWidget>()
    for (part in parts.sortedBy { it.definition["priority"].number() }) {
        val current = grouped[part.key]
        grouped[part.key] =
            when {
                current == null ->
                    part.copy(notes = if (part.kind == "note") listOf(part) else emptyList())
                part.kind != "note" && current.kind == "note" -> part.copy(notes = current.notes)
                else -> current.copy(notes = current.notes + part)
            }
    }
    return grouped.values.toList()
}

fun featureWidgetPatches(
    sheet: CharacterSheet,
    key: String,
    items: Map<Long, CatalogueItem>,
): List<SheetPatch> {
    val widget =
        featureWidgets(sheet, items).firstOrNull { it.key == key }
            ?: error("Блок способности больше недоступен.")
    require(widget.kind == "toggle") { "У этого блока нет переключателя." }
    val activating = !widget.active
    require(!activating || widget.unavailable.isBlank()) { widget.unavailable }
    val patches = mutableListOf<SheetPatch>()
    val resource = widget.resource
    if (activating && !widget.unlimited && resource != null && resource.total > 0) {
        require(resource.value > 0) { "Нет доступных использований." }
        patches.addAll(resourceChangePatches(sheet, resource, resource.value - 1, items))
    }
    val working = sheet.copy(data = applySheetPatches(sheet.data, patches))
    if (widget.link != null)
        patches.add(
            toggleLinkedStatus(
                working,
                widget.feature,
                widget.link,
                items,
                removeAll = !activating && widget.feature.key != "magic_items",
            )
        )
    else
        patches.add(
            sheetFieldPatch(
                working,
                featureEntryPath(working, widget.feature) +
                    sheetPath("widget_states", widget.stateKey),
                JsonPrimitive(activating),
            )
        )
    return patches
}
