package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

private fun inventorySlot(value: JsonElement?): Int? {
    val raw = (value as? JsonPrimitive)?.takeUnless { it.isString }?.doubleOrNull ?: return null
    return raw.takeIf { it.isFinite() && it >= 0 && it <= Int.MAX_VALUE && it % 1.0 == 0.0 }
        ?.toInt()
}

fun resolveInventorySlots(entries: List<JsonObject>, positions: JsonObject): Map<String, Int> {
    val result = linkedMapOf<String, Int>()
    val used = mutableSetOf<Int>()
    for (entry in entries) {
        val key = entry.text("uid")
        val slot = inventorySlot(positions[key])
        if (slot != null && used.add(slot)) result[key] = slot
    }
    var free = 0
    for (entry in entries) {
        val key = entry.text("uid")
        if (key in result) continue
        while (free in used) free++
        result[key] = free
        used.add(free)
    }
    return result
}

fun inventorySpaceEntries(model: JsonObject, id: String): List<JsonObject> {
    val section =
        model["sections"].arrayValue().map { it.objectValue() }.firstOrNull { it.text("id") == id }
            ?: return emptyList()
    return section["items"].arrayValue().map { it.objectValue() } +
        model["equipped"]
            .arrayValue()
            .map { it.objectValue() }
            .filter { it.text("uid") in section["slots"].objectValue() }
}

/**
 * Slots locate equipped items physically; the global equipped array remains the mechanics source.
 */
fun normalizeInventorySpaces(source: JsonObject): JsonObject {
    val equipped = source["equipped"].arrayValue().map { it.objectValue() }
    val sections =
        source["sections"]
            .arrayValue()
            .map { it.objectValue() }
            .ifEmpty {
                listOf(
                    buildJsonObject {
                        put("id", "default")
                        put("name", "Рюкзак")
                        put("items", JsonArray(emptyList()))
                        put("slots", JsonObject(emptyMap()))
                    }
                )
            }
    val owners = equipped.associate { entry ->
        entry.text("uid") to
            (sections.firstOrNull {
                    inventorySlot(it["slots"].objectValue()[entry.text("uid")]) != null
                } ?: sections.first())
                .text("id")
    }
    val resolved = sections.map { section ->
        val entries =
            section["items"].arrayValue().map { it.objectValue() } +
                equipped.filter { owners[it.text("uid")] == section.text("id") }
        JsonObject(
            section +
                ("slots" to
                    JsonObject(
                        resolveInventorySlots(entries, section["slots"].objectValue()).mapValues {
                            JsonPrimitive(it.value)
                        }
                    ))
        )
    }
    return JsonObject(
        source + mapOf("equipped" to JsonArray(equipped), "sections" to JsonArray(resolved))
    )
}

fun inventoryColumns(width: Float): Int =
    ((width.coerceAtLeast(0f) + 8) / 80).toInt().coerceAtLeast(1)

fun inventoryCells(
    entries: List<JsonObject>,
    positions: JsonObject,
    columns: Int,
): List<JsonObject?> {
    val count = columns.coerceAtLeast(1)
    val slots = resolveInventorySlots(entries, positions)
    val last = slots.values.maxOrNull() ?: -1
    val size = maxOf(count, ((last + count) / count) * count)
    val cells = MutableList<JsonObject?>(size) { null }
    for (entry in entries) cells[slots.getValue(entry.text("uid"))] = entry
    if (cells.takeLast(count).any { it != null }) repeat(count) { cells.add(null) }
    return cells
}

fun moveInventoryCell(
    source: JsonObject,
    uid: String,
    fromId: String,
    toId: String,
    toSlot: Int,
): JsonObject {
    require(toSlot >= 0) { "Выберите ячейку назначения." }
    val model = normalizeInventorySpaces(source)
    val sections = model["sections"].arrayValue().map { it.objectValue() }.toMutableList()
    val fromIndex = sections.indexOfFirst { it.text("id") == fromId }
    val toIndex = sections.indexOfFirst { it.text("id") == toId }
    require(fromIndex >= 0 && toIndex >= 0) { "Хранилище больше недоступно." }
    val from = sections[fromIndex]
    val to = sections[toIndex]
    val moved =
        inventorySpaceEntries(model, fromId).firstOrNull { it.text("uid") == uid }
            ?: error("Предмет уже перемещён.")
    val occupied =
        inventorySpaceEntries(model, toId).firstOrNull {
            inventorySlot(to["slots"].objectValue()[it.text("uid")]) == toSlot
        }
    if (occupied?.text("uid") == uid) return source
    val oldSlot = from["slots"].objectValue().getValue(uid)
    val worn = model["equipped"].arrayValue().map { it.objectValue().text("uid") }.toSet()
    val fromItems = from["items"].arrayValue().toMutableList()
    val toItems = if (fromIndex == toIndex) fromItems else to["items"].arrayValue().toMutableList()
    val fromSlots = from["slots"].objectValue().toMutableMap()
    val toSlots = if (fromIndex == toIndex) fromSlots else to["slots"].objectValue().toMutableMap()
    if (fromIndex != toIndex) {
        if (uid !in worn) {
            fromItems.removeAll { it.objectValue().text("uid") == uid }
            toItems.add(moved)
        }
        if (occupied != null && occupied.text("uid") !in worn) {
            toItems.removeAll { it.objectValue().text("uid") == occupied.text("uid") }
            fromItems.add(occupied)
        }
        fromSlots.remove(uid)
        occupied?.let { toSlots.remove(it.text("uid")) }
    }
    if (occupied != null) fromSlots[occupied.text("uid")] = oldSlot
    toSlots[uid] = JsonPrimitive(toSlot)
    sections[fromIndex] =
        JsonObject(from + mapOf("items" to JsonArray(fromItems), "slots" to JsonObject(fromSlots)))
    sections[toIndex] =
        JsonObject(to + mapOf("items" to JsonArray(toItems), "slots" to JsonObject(toSlots)))
    return JsonObject(model + ("sections" to JsonArray(sections)))
}

fun canEquipInventoryItem(item: CatalogueItem?): Boolean {
    val data = item?.data ?: JsonObject(emptyMap())
    return item?.typeId in listOf(1L, 12L) ||
        data["armor"] is JsonObject ||
        data["armor_base"] is JsonObject ||
        data["weapon"] is JsonObject ||
        item?.typeId == 19L && data.text("activation") != "carried" ||
        data.values.any { raw ->
            raw.arrayValue().any { it.objectValue().text("activation") == "equipped" }
        }
}

fun toggleInventoryEquipment(source: JsonObject, uid: String): JsonObject {
    val model = normalizeInventorySpaces(source)
    val sections = model["sections"].arrayValue().map { it.objectValue() }.toMutableList()
    val index = sections.indexOfFirst {
        inventorySpaceEntries(model, it.text("id")).any { entry -> entry.text("uid") == uid }
    }
    require(index >= 0) { "Предмет больше недоступен." }
    val equipped = model["equipped"].arrayValue().toMutableList()
    val items = sections[index]["items"].arrayValue().toMutableList()
    val worn = equipped.indexOfFirst { it.objectValue().text("uid") == uid }
    if (worn >= 0) items.add(equipped.removeAt(worn))
    else {
        val at = items.indexOfFirst { it.objectValue().text("uid") == uid }
        require(at >= 0)
        equipped.add(items.removeAt(at))
    }
    sections[index] = JsonObject(sections[index] + ("items" to JsonArray(items)))
    return JsonObject(
        model + mapOf("equipped" to JsonArray(equipped), "sections" to JsonArray(sections))
    )
}

fun removeInventorySpace(source: JsonObject, id: String): JsonObject {
    val model = normalizeInventorySpaces(source)
    val sections = model["sections"].arrayValue().map { it.objectValue() }
    require(sections.any { it.text("id") == id }) { "Хранилище больше недоступно." }
    val removed = inventorySpaceEntries(model, id).map { it.text("uid") }.toSet()
    val remaining =
        sections
            .filterNot { it.text("id") == id }
            .ifEmpty {
                listOf(
                    buildJsonObject {
                        put("id", java.util.UUID.randomUUID().toString())
                        put("name", "Рюкзак")
                        put("items", JsonArray(emptyList()))
                        put("slots", JsonObject(emptyMap()))
                    }
                )
            }
    return JsonObject(
        model +
            mapOf(
                "sections" to JsonArray(remaining),
                "equipped" to
                    JsonArray(
                        model["equipped"].arrayValue().filterNot {
                            it.objectValue().text("uid") in removed
                        }
                    ),
            )
    )
}

fun inventoryTypeIds(types: List<ItemType>, root: Long = 2): List<Long> {
    val result = mutableListOf(root)
    val seen = mutableSetOf(root)
    val queue = ArrayDeque(types.filter { it.parentTypeId == root }.map { it.id })
    while (queue.isNotEmpty()) {
        val id = queue.removeFirst()
        if (!seen.add(id)) continue
        result.add(id)
        types.filter { it.parentTypeId == id }.forEach { queue.addLast(it.id) }
    }
    return result
}
