package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

val featureActionTypes =
    linkedMapOf(
        "action" to "Действия",
        "bonus_action" to "Бонусные действия",
        "reaction" to "Реакции",
        "free" to "Свободные действия",
        "special" to "Особые действия",
        "timed" to "Действия с временем",
    )

data class FeatureAction(
    val key: String,
    val title: String,
    val type: String,
    val description: String,
    val definition: JsonObject,
    val feature: OwnedFeature? = null,
    val resource: ResourceControl? = null,
    val manualIndex: Int? = null,
)

fun featureActions(sheet: CharacterSheet, items: Map<Long, CatalogueItem>): List<FeatureAction> {
    val resources = resourceControls(sheet, items)
    val codes =
        sheet.values["states"]
            .arrayValue()
            .mapNotNull { items[it.objectValue()["effect_id"].referenceId()]?.data?.text("code") }
            .toSet()
    val all = buildList {
        for ((index, raw) in sheet.values["actions"].arrayValue().withIndex()) {
            val row = raw.objectValue()
            add(
                FeatureAction(
                    "manual:${row.text("uid").ifBlank { index.toString() }}",
                    row.text("title").ifBlank { "Своё действие" },
                    row.text("action_type").takeIf { it in featureActionTypes } ?: "special",
                    row.text("description"),
                    row,
                    manualIndex = index,
                )
            )
        }
        for (feature in ownedFeatures(sheet, items)) {
            if (
                feature.item.typeId == 19L &&
                    !magicActive(feature.item, feature.instance, feature.equipped, sheet)
            )
                continue
            for ((index, raw) in feature.item.data["feature_actions"].arrayValue().withIndex()) {
                val row = raw.objectValue()
                if (
                    ownerLevel(feature.item.data, sheet) < row["level"].number(1) ||
                        row["required_status_codes"].arrayValue().any {
                            it.jsonPrimitive.content !in codes
                        }
                )
                    continue
                val pool = row.text("resource_pool_key")
                val ownerId = row["resource_item_id"].referenceId()
                val owner =
                    if (ownerId != null && ownerId > 0)
                        ownedFeatures(sheet, items).firstOrNull {
                            it.item.id == ownerId &&
                                (feature.key != "magic_items" ||
                                    ownerId != feature.item.id ||
                                    featureEntryKey(it) == featureEntryKey(feature))
                        }
                    else feature
                val prefix = owner?.let { "abilities:${it.key}:${featureEntryKey(it)}" }
                val resourceKey = row.text("resource_key")
                val resource =
                    when {
                        pool.isNotBlank() ->
                            resources.firstOrNull {
                                it.key == "classes:$pool" || it.rule.text("pool_key") == pool
                            }
                        ownerId != null && ownerId > 0 ||
                            row["uses_resource"] == JsonPrimitive(true) ||
                            resourceKey.isNotBlank() ->
                            resources.firstOrNull { resource ->
                                if (prefix == null) false
                                else if (resourceKey.isNotBlank())
                                    resource.key == "$prefix:$resourceKey"
                                else
                                    resource.key == prefix ||
                                        (ownerId != null && resource.key.startsWith("$prefix:"))
                            }
                        else -> null
                    }
                add(
                    FeatureAction(
                        "feature:${feature.key}:${featureEntryKey(feature)}:${row.text("key").ifBlank { index.toString() }}",
                        row.text("title").ifBlank { feature.item.name },
                        row.text("action_type").takeIf { it in featureActionTypes } ?: "special",
                        row.text("description"),
                        row,
                        feature,
                        resource,
                    )
                )
            }
        }
    }
    val order =
        sheet.values["action_order"]
            .arrayValue()
            .map { it.jsonPrimitive.content }
            .withIndex()
            .associate { it.value to it.index }
    return all.sortedWith(
        compareBy<FeatureAction> { featureActionTypes.keys.indexOf(it.type) }
            .thenBy { order[it.key] ?: Int.MAX_VALUE }
            .thenBy { it.definition["priority"].number(it.manualIndex ?: 0) }
            .thenBy { it.title }
    )
}

fun featureActionPatches(
    sheet: CharacterSheet,
    key: String,
    input: JsonObject,
    items: Map<Long, CatalogueItem>,
): List<SheetPatch> {
    val action =
        featureActions(sheet, items).firstOrNull { it.key == key }
            ?: error("Действие больше недоступно.")
    if (input.text("operation") == "effect") {
        val effect =
            action.definition["menu_effects"]
                .arrayValue()
                .map { it.objectValue() }
                .withIndex()
                .firstOrNull { (index, row) ->
                    row.text("key").ifBlank {
                        "${row.text("value_id")}:${row.text("counter_key")}:$index"
                    } == input.text("effectKey")
                }
                ?.value ?: error("Последствие больше недоступно.")
        require(
            effect.text("kind") == "adjust_counter" &&
                effect.text("value_id").isNotBlank() &&
                effect.text("counter_key").isNotBlank()
        )
        val current =
            sheet.values[effect.text("value_id")].objectValue()[effect.text("counter_key")].number()
        val min = effect["min"].number()
        val max = effect["max"].number(Int.MAX_VALUE)
        require(max >= min)
        val next =
            (current.toLong() + effect["delta"].number())
                .coerceIn(min.toLong(), max.toLong())
                .toInt()
        require(next != current) { "Показатель уже достиг предела." }
        return listOf(
            sheetFieldPatch(
                sheet,
                sheetPath("values", effect.text("value_id"), effect.text("counter_key")),
                JsonPrimitive(next),
            )
        )
    }
    require(
        input.text("operation") == "target" && action.definition.text("target_kind") == "weapon"
    ) {
        "Выберите цель действия."
    }
    val targetUid = input.text("targetUid")
    val target =
        sheet.values["weapon"]
            .arrayValue()
            .map { it.objectValue() }
            .firstOrNull { it.text("uid") == targetUid } ?: error("Оружие больше не существует.")
    val effect =
        items.values.firstOrNull {
            it.typeId == 15L &&
                it.data.text("code") == action.definition.text("status_effect_code") &&
                it.data.text("code").isNotBlank()
        } ?: error("Дождитесь загрузки эффекта из справочника.")
    val parameter = action.definition.text("target_parameter").ifBlank { "weapon_uid" }
    require(
        sheet.values["states"].arrayValue().none {
            it.objectValue()["effect_id"].referenceId() == effect.id &&
                it.objectValue()["params"].objectValue().text(parameter) == targetUid
        }
    ) {
        "Эффект уже действует на это оружие."
    }
    val cost = action.definition["resource_cost"].number().coerceAtLeast(0)
    val patches = mutableListOf<SheetPatch>()
    if (cost > 0) {
        val resource = action.resource ?: error("Ресурс действия недоступен.")
        require(resource.value >= cost) { "Недостаточно ресурса для применения." }
        patches.addAll(resourceChangePatches(sheet, resource, resource.value - cost, items))
    }
    val created =
        createStatusInstance(
            effect,
            buildJsonObject {
                put("kind", "feature_action")
                action.feature?.let { put("item_id", it.item.id) }
                put("label", action.title)
            },
            buildJsonObject {
                put(parameter, targetUid)
                put("target_name", resolveWeapon(target, items)?.name ?: "Оружие")
            },
        )
    patches.add(
        SheetPatch(
            path = sheetPath("values", "states"),
            value =
                JsonArray(addStatusInstance(sheet.values["states"].arrayValue(), effect, created)),
        )
    )
    return patches
}
