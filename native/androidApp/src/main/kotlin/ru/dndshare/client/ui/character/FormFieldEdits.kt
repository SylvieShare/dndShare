package ru.dndshare.client.ui.character

import kotlinx.serialization.json.*
import ru.dndshare.client.character.*

/**
 * Reads the latest model input even when a native buffer flush uses an older composition callback.
 */
internal fun FeatureFormScope.field(path: List<String>, value: JsonElement) {
    require(path.isNotEmpty())
    fun replace(node: JsonObject, parts: List<String>): JsonObject {
        val key = parts.first()
        val next = if (parts.size == 1) value else replace(node[key].objectValue(), parts.drop(1))
        return JsonObject(node + (key to next))
    }
    val changed = replace(data, path)
    input(path.first(), changed.getValue(path.first()))
}

internal fun FeatureFormScope.row(path: List<String>, index: Int, key: String, value: JsonElement) {
    var node: JsonElement = data
    for (part in path) node = node.objectValue()[part] ?: JsonArray(emptyList())
    val rows = node.arrayValue().toMutableList()
    if (index !in rows.indices) return
    rows[index] = JsonObject(rows[index].objectValue() + (key to value))
    field(path, JsonArray(rows))
}

internal fun FeatureFormScope.rows(
    path: List<String>,
    change: (List<JsonElement>) -> List<JsonElement>,
) {
    var node: JsonElement = data
    for (part in path) node = node.objectValue()[part] ?: JsonArray(emptyList())
    field(path, JsonArray(change(node.arrayValue())))
}
