package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

fun inventoryEntry(model: JsonObject, uid: String): JsonObject? =
    (model["equipped"].arrayValue() +
            model["sections"].arrayValue().flatMap { it.objectValue()["items"].arrayValue() })
        .map { it.objectValue() }
        .singleOrNull { it.text("uid") == uid }

fun inventoryActionPatches(
    sheet: CharacterSheet,
    uid: String,
    operation: String,
    input: JsonObject,
    items: Map<Long, CatalogueItem>,
): List<SheetPatch> {
    val before = sheet.values["items"].objectValue()
    val model = normalizeInventorySpaces(before)
    if (operation == "inventory-section-delete")
        return listOf(
            SheetPatch(
                path = sheetPath("values", "items"),
                value = removeInventorySpace(model, uid),
            )
        )
    val entry = inventoryEntry(model, uid) ?: error("Предмет больше недоступен.")
    val next =
        when (operation) {
            "inventory-equip" -> {
                val worn =
                    model["equipped"].arrayValue().any { it.objectValue().text("uid") == uid }
                require(worn || canEquipInventoryItem(resolveInventoryItem(entry, items))) {
                    "Этот предмет нельзя экипировать."
                }
                toggleInventoryEquipment(model, uid)
            }
            "inventory-cell",
            "inventory-move" -> {
                val from =
                    input.text("fromId").ifBlank {
                        model["sections"]
                            .arrayValue()
                            .map { it.objectValue() }
                            .firstOrNull { uid in it["slots"].objectValue() }
                            ?.text("id")
                            .orEmpty()
                    }
                val to = input.text("toId")
                val destination =
                    model["sections"]
                        .arrayValue()
                        .map { it.objectValue() }
                        .singleOrNull { it.text("id") == to }
                        ?: error("Хранилище больше недоступно.")
                val slot =
                    if (input["toSlot"] != null) input["toSlot"].number(-1)
                    else {
                        val used =
                            resolveInventorySlots(
                                    inventorySpaceEntries(model, to),
                                    destination["slots"].objectValue(),
                                )
                                .values
                                .toSet()
                        generateSequence(0) { it + 1 }.first { it !in used }
                    }
                moveInventoryCell(model, uid, from, to, slot)
            }
            "inventory-count",
            "inventory-delete" -> {
                val count =
                    if (operation == "inventory-delete") 0
                    else entry["count"].number(1) + input["delta"].number()
                require(count in 0..1_000_000) { "Количество должно быть от 0 до 1000000." }
                fun change(rows: List<JsonElement>) = rows.mapNotNull { raw ->
                    if (raw.objectValue().text("uid") != uid) raw
                    else if (count == 0) null
                    else JsonObject(raw.objectValue() + ("count" to JsonPrimitive(count)))
                }
                val sections =
                    model["sections"].arrayValue().map { raw ->
                        val row = raw.objectValue()
                        JsonObject(
                            row +
                                mapOf(
                                    "items" to JsonArray(change(row["items"].arrayValue())),
                                    "slots" to
                                        if (count == 0) JsonObject(row["slots"].objectValue() - uid)
                                        else row["slots"].objectValue(),
                                )
                        )
                    }
                JsonObject(
                    model +
                        mapOf(
                            "equipped" to JsonArray(change(model["equipped"].arrayValue())),
                            "sections" to JsonArray(sections),
                        )
                )
            }
            else -> error("Неизвестное действие инвентаря.")
        }
    return if (next == before) emptyList()
    else listOf(SheetPatch(path = sheetPath("values", "items"), value = next))
}
