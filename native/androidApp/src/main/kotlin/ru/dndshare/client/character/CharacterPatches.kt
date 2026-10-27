package ru.dndshare.client.character

import kotlinx.serialization.json.*
import java.util.UUID

fun sheetValue(document: JsonElement?, path: List<JsonElement>): JsonElement? {
    var current = document
    for (part in path) current = when (part) {
        is JsonPrimitive -> (current as? JsonObject)?.get(part.content)
        is JsonObject -> (current as? JsonArray)?.singleOrNull { row ->
            (row as? JsonObject)?.get(part.getValue("idField").jsonPrimitive.content) == part["id"]
        }
        else -> error("Недопустимый путь изменения.")
    }
    return current
}

private fun selectorIndex(array: JsonArray, selector: JsonObject): Int {
    val field = selector.getValue("idField").jsonPrimitive.content
    val matches = array.indices.filter { (array[it] as? JsonObject)?.get(field) == selector["id"] }
    require(matches.size <= 1) { "Повторяющийся идентификатор записи." }
    return matches.firstOrNull() ?: -1
}

private fun changeAt(node: JsonElement, path: List<JsonElement>, replacement: (JsonElement?) -> JsonElement?): JsonElement {
    require(path.isNotEmpty())
    val part = path.first()
    val rest = path.drop(1)
    return when (part) {
        is JsonPrimitive -> {
            require(part.isString && node is JsonObject) { "Путь не указывает на поле документа." }
            val old = node[part.content]
            val next = if (rest.isEmpty()) replacement(old) else changeAt(requireNotNull(old), rest, replacement)
            JsonObject(node.toMutableMap().apply { if (next == null) remove(part.content) else put(part.content, next) })
        }
        is JsonObject -> {
            require(node is JsonArray)
            val index = selectorIndex(node, part)
            require(index >= 0) { "Запись больше не существует." }
            val next = if (rest.isEmpty()) replacement(node[index]) else changeAt(node[index], rest, replacement)
            JsonArray(node.toMutableList().apply { if (next == null) removeAt(index) else set(index, next) })
        }
        else -> error("Недопустимый путь изменения.")
    }
}

fun applySheetPatches(document: JsonObject, patches: List<SheetPatch>): JsonObject = patches.fold(document) { current, patch ->
    val changed = when (patch.op) {
        "set" -> changeAt(current, patch.path) { patch.value }
        "remove" -> changeAt(current, patch.path) { null }
        "insert" -> {
            val selector = patch.path.last().jsonObject
            changeAt(current, patch.path.dropLast(1)) { old ->
                val array = old as? JsonArray ?: error("Путь не указывает на список.")
                require(selectorIndex(array, selector) < 0)
                require(patch.value.jsonObject[selector.getValue("idField").jsonPrimitive.content] == selector["id"])
                val list = array.toMutableList()
                val before = patch.beforeId?.let { id -> list.indexOfFirst { it.jsonObject[selector.getValue("idField").jsonPrimitive.content] == id } }
                if (before != null && before >= 0) list.add(before, patch.value) else list.add(patch.value)
                JsonArray(list)
            }
        }
        "order" -> changeAt(current, patch.path) { old ->
            val array = old as? JsonArray ?: error("Путь не указывает на список.")
            val field = requireNotNull(patch.idField)
            val rows = array.associateBy { it.jsonObject[field] }
            val ids = patch.value.jsonArray
            require(rows.size == array.size && ids.size == rows.size && ids.toSet() == rows.keys)
            JsonArray(ids.map { rows.getValue(it) })
        }
        else -> error("Неизвестная операция документа: ${patch.op}")
    }
    changed.jsonObject
}

fun createSheetEdit(document: JsonObject, patches: List<SheetPatch>): SheetEdit {
    require(patches.isNotEmpty())
    applySheetPatches(document, patches)
    return SheetEdit(UUID.randomUUID().toString(), patches, patches.map { patch ->
        val previous = sheetValue(document, patch.path)
        SheetPrecondition(patch.path, previous != null, previous ?: JsonNull)
    })
}

/** Null means conflict. Matching remote results are already applied. */
fun rebaseSheetEdit(edit: SheetEdit, remote: JsonObject): SheetEdit? {
    val remaining = mutableListOf<Int>()
    for ((index, patch) in edit.patches.withIndex()) {
        val actual = sheetValue(remote, patch.path)
        val desired = if (patch.op == "remove") null else patch.value
        if (actual == desired) continue
        val previous = edit.before[index]
        if ((actual != null) != previous.exists || actual != previous.value.takeIf { previous.exists }) return null
        remaining += index
    }
    return edit.copy(id = UUID.randomUUID().toString(), patches = remaining.map(edit.patches::get),
        before = remaining.map(edit.before::get))
}
