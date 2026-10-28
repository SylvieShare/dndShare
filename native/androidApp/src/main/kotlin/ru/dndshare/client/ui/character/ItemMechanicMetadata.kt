package ru.dndshare.client.ui.character

import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

internal fun itemMechanicMetadata(
    sheet: CharacterSheet,
    uid: String,
    operation: String,
    input: JsonObject,
    items: Map<Long, CatalogueItem>,
    session: String?,
): List<JsonObject> {
    if (operation == "inventory-section-delete") {
        val model = normalizeInventorySpaces(sheet.values["items"].objectValue())
        val section =
            model["sections"]
                .arrayValue()
                .map { it.objectValue() }
                .firstOrNull { it.text("id") == uid } ?: return emptyList()
        val removed = inventorySpaceEntries(model, uid)
        if (removed.isEmpty()) return emptyList()
        return sessionMetadata(
            session,
            "item_removed",
            "Удалены предметы секции: ${section.text("name")}",
            buildJsonObject {
                put("sectionName", section.text("name"))
                put(
                    "removedEntries",
                    JsonArray(
                        removed.map { entry ->
                            val id = entry["magic_item_id"] ?: entry["item_id"] ?: JsonNull
                            val name =
                                entry["override"].objectValue().text("name").ifBlank {
                                    resolveInventoryItem(entry, items)?.name ?: "Предмет"
                                }
                            buildJsonObject {
                                put(
                                    "source",
                                    buildJsonObject {
                                        put("itemId", id)
                                        put("name", name)
                                        put("instanceUid", entry.text("uid"))
                                    },
                                )
                                put("itemId", id)
                                put("count", entry["count"].number(1))
                                put("remaining", 0)
                            }
                        }
                    ),
                )
            },
        )
    }
    if (operation in setOf("inventory-count", "inventory-delete")) {
        val entry = inventoryEntry(sheet.values["items"].objectValue(), uid) ?: return emptyList()
        val before = entry["count"].number(1)
        val after = if (operation == "inventory-delete") 0 else before + input["delta"].number()
        if (after == before) return emptyList()
        val item = resolveInventoryItem(entry, items)
        val name = entry["override"].objectValue().text("name").ifBlank { item?.name ?: "Предмет" }
        val id = (entry["magic_item_id"] ?: entry["item_id"])
        return sessionMetadata(
            session,
            if (after > before) "item_added" else "item_removed",
            if (after > before) "Добавлено: $name" else "Удалено: $name",
            buildJsonObject {
                put(
                    "source",
                    buildJsonObject {
                        put("itemId", id ?: JsonNull)
                        put("name", name)
                        put("instanceUid", uid)
                    },
                )
                put("itemId", id ?: JsonNull)
                put("count", kotlin.math.abs(before - after))
                put("remaining", after)
            },
        )
    }
    if (operation == "spell-slot") {
        val level = input["level"].number()
        val row =
            sheet.values["spells"]
                .objectValue()["slot_pools"]
                .objectValue()[uid]
                .arrayValue()
                .map { it.objectValue() }
                .single { it["level"].number() == level }
        val used = input["used"].number()
        return sessionMetadata(
            session,
            "spell_slot_changed",
            if (used > row["used"].number()) "Использование ячеек" else "Восстановление ячеек",
            buildJsonObject {
                put("slotLevel", level)
                put("slotPool", uid)
                put(
                    "resourceChanges",
                    buildJsonArray {
                        add(
                            buildJsonObject {
                                put("key", "spell:$uid:$level")
                                put("name", "Ячейка $level круга")
                                put("level", level)
                                put("pool", uid)
                                put("delta", row["used"].number() - used)
                                put("remaining", row["total"].number() - used)
                                put("total", row["total"].number())
                            }
                        )
                    },
                )
            },
        )
    }
    if (operation == "feature-action") {
        val action = featureActions(sheet, items).first { it.key == uid }
        return sessionMetadata(
            session,
            "feature_action_effect",
            action.title,
            buildJsonObject {
                put("actionKey", uid)
                action.feature?.let {
                    put(
                        "source",
                        buildJsonObject {
                            put("itemId", it.item.id)
                            put("name", it.item.name)
                        },
                    )
                }
                if (input.text("operation") == "target") {
                    put("targetKind", "weapon")
                    put("targetUid", input.text("targetUid"))
                    action.resource?.let { resource ->
                        val cost = action.definition["resource_cost"].number()
                        if (cost > 0)
                            put(
                                "resourceChanges",
                                buildJsonArray {
                                    add(
                                        buildJsonObject {
                                            put("key", resource.key)
                                            put("name", resource.title)
                                            put("delta", -cost)
                                            put("remaining", resource.value - cost)
                                            put("total", resource.total)
                                        }
                                    )
                                },
                            )
                    }
                } else put("effectKey", input.text("effectKey"))
            },
        )
    }
    if (operation == "resource-set") {
        val resource = resourceControls(sheet, items).first { it.key == uid }
        val next = input["value"].number()
        return sessionMetadata(
            session,
            "resource_change",
            resource.title,
            buildJsonObject {
                put(
                    "resourceChanges",
                    buildJsonArray {
                        add(
                            buildJsonObject {
                                put("key", uid)
                                put("name", resource.title)
                                put("delta", next - resource.value)
                                put("remaining", next)
                                put("total", resource.total)
                            }
                        )
                    },
                )
            },
        )
    }
    if (operation == "feature-widget") {
        val widget = featureWidgets(sheet, items).first { it.key == uid }
        return sessionMetadata(
            session,
            "feature_state",
            "${widget.title}: ${if(widget.active) "выключено" else widget.definition.text("active_label").ifBlank { "Активно" }}",
            buildJsonObject {
                put(
                    "source",
                    buildJsonObject {
                        put("itemId", widget.feature.item.id)
                        put("name", widget.feature.item.name)
                    },
                )
                if (!widget.active && !widget.unlimited)
                    widget.resource
                        ?.takeIf { it.total > 0 }
                        ?.let { resource ->
                            put(
                                "resourceChanges",
                                buildJsonArray {
                                    add(
                                        buildJsonObject {
                                            put("key", resource.key)
                                            put("name", resource.title)
                                            put("delta", -1)
                                            put("remaining", resource.value - 1)
                                            put("total", resource.total)
                                        }
                                    )
                                },
                            )
                        }
            },
        )
    }
    if (operation == "ability-status") {
        val feature =
            ownedFeatures(sheet, items).first {
                it.key == input.text("bucket") && featureEntryKey(it) == uid
            }
        return sessionMetadata(
            session,
            "feature_state",
            feature.item.name,
            buildJsonObject {
                put(
                    "source",
                    buildJsonObject {
                        put("itemId", feature.item.id)
                        put("name", feature.item.name)
                    },
                )
                put("linkKey", input.text("link"))
            },
        )
    }
    return emptyList()
}
