package ru.dndshare.client.ui

import androidx.compose.ui.graphics.Color
import kotlinx.serialization.json.*
import ru.dndshare.client.model.*
import ru.dndshare.designsystem.*

internal fun catalogueColor(value: String?): Color = runCatching {
    Color(android.graphics.Color.parseColor(value))
}.getOrDefault(WebPalette.AccentSoft)

internal data class CollectionGroup(val name: String, val types: List<ItemType>)

internal fun collectionGroups(types: List<ItemType>): List<CollectionGroup> {
    val features = setOf(3L, 4L, 7L, 18L)
    val other = types.filter { it.id !in features }
    val ids = other.map { it.id }.toSet()
    val roots = other.filter { it.parentTypeId !in ids }
    fun descendants(root: Long, seen: Set<Long>): List<ItemType> = other.filter { it.parentTypeId == root && it.id !in seen }
        .flatMap { listOf(it) + descendants(it.id, seen + it.id) }
    val families = roots.map { it to descendants(it.id, setOf(it.id)) }
    return buildList {
        val independent = families.filter { it.second.isEmpty() }.map { it.first }
        if (independent.isNotEmpty()) add(CollectionGroup("Основные разделы", independent))
        val abilities = types.filter { it.id in features }
        if (abilities.isNotEmpty()) add(CollectionGroup("Способности и черты", abilities))
        families.filter { it.second.isNotEmpty() }.forEach { add(CollectionGroup(it.first.name, listOf(it.first) + it.second)) }
    }
}

internal fun schemaPath(data: JsonObject, path: String): JsonElement? = path.split('.').fold(data as JsonElement?) { value, key ->
    (value as? JsonObject)?.get(key)
}

internal fun readableValue(value: JsonElement?, field: JsonObject, metadata: HandbookMetadata): String {
    if (value == null || value is JsonNull) return ""
    if (field.text("type") == "int_by_suggest" && value is JsonObject) {
        val amount = (value["value"] as? JsonPrimitive)?.content.orEmpty()
        val unit = (value["suggest_id"] as? JsonPrimitive)?.longOrNull?.let { metadata.suggest(it)?.value }.orEmpty()
        return "$amount $unit".trim()
    }
    if (value is JsonArray) return value.map { readableValue(it, field, metadata) }.filter(String::isNotBlank).joinToString(", ")
    if (value is JsonObject) return value.entries.joinToString(" · ") { (key, nested) ->
        val child = (field["fields"] as? JsonArray)?.filterIsInstance<JsonObject>()?.firstOrNull { it.text("key") == key }
        val text = readableValue(nested, child ?: JsonObject(emptyMap()), metadata)
        if (text.isEmpty()) "" else if (child != null) "${child.text("name")}: $text" else text
    }
    val primitive = value as? JsonPrimitive ?: return ""
    if (primitive.booleanOrNull != null) return if (primitive.boolean) "Да" else "Нет"
    val type = field.text("type")
    if (type in setOf("suggest", "suggest_array")) return primitive.longOrNull?.let { metadata.suggest(it)?.value } ?: primitive.content
    if (type in setOf("select", "enum_array")) return (field["options"] as? JsonArray)?.filterIsInstance<JsonObject>()
        ?.firstOrNull { it["value"] == primitive }?.let { it.text("label").ifBlank { it.text("name") } } ?: primitive.content
    return primitive.content
}

internal fun schemaLeaves(fields: JsonArray, prefix: String = ""): List<Pair<String, JsonObject>> =
    fields.filterIsInstance<JsonObject>().flatMap { field ->
        val path = prefix + field.text("key")
        if (field.text("type") == "object") schemaLeaves(field["fields"] as? JsonArray ?: JsonArray(emptyList()), "$path.")
        else listOf(path to field)
    }

internal fun filterFields(fields: JsonArray): List<Pair<String, JsonObject>> = schemaLeaves(fields)
    .filter { (_, field) -> (field["filter"] as? JsonPrimitive)?.booleanOrNull == true }
    .map { (path, field) -> field.text("filter_path").ifBlank { path } to field }

internal fun numericGroup(value: String): Double {
    val pieces = value.split('/')
    return if (pieces.size == 2) (pieces[0].toDoubleOrNull() ?: Double.POSITIVE_INFINITY) /
        (pieces[1].toDoubleOrNull()?.takeIf { it != 0.0 } ?: 1.0)
    else value.toDoubleOrNull() ?: Double.POSITIVE_INFINITY
}


internal fun itemStats(type: ItemType?, item: CatalogueItem, metadata: HandbookMetadata): List<ShareStat> {
    val fields = type?.fields as? JsonArray ?: return emptyList()
    if (item.typeId == 5L) {
        fun obj(key: String) = item.data[key] as? JsonObject
        val time = obj("time")
        val range = obj("range")
        val action = mapOf("action" to "Действие", "bonus_action" to "Бонусное действие", "reaction" to "Реакция", "free" to "Свободное действие")
        val units = mapOf("rounds" to "раунд.", "minutes" to "мин.", "hours" to "ч.", "days" to "дн.")
        val timeKind = time?.text("kind").orEmpty()
        val timeText = action[timeKind] ?: units[timeKind]?.let { "${time?.get("value")?.jsonPrimitive?.content.orEmpty()} $it" }
            ?: time?.text("text").orEmpty()
        val rangeText = when (range?.text("kind")) {
            "self" -> "На себя"; "touch" -> "Касание"; "sight" -> "Видимость"; "unlimited" -> "Без ограничений"
            "ranged" -> "${range["distance"]?.jsonPrimitive?.content.orEmpty()} ${if (range.text("unit") == "miles") "миль" else "фт."}"
            else -> range?.text("text").orEmpty()
        }
        return buildList {
            (item.data["lvl"] as? JsonPrimitive)?.content?.let { add(ShareStat("Уровень", if (it == "0") "Заговор" else it)) }
            (item.data["schoolId"] as? JsonPrimitive)?.longOrNull?.let { metadata.suggest(it)?.value }?.let { add(ShareStat("Школа", it)) }
            if (timeText.isNotBlank()) add(ShareStat("Время", timeText))
            if (rangeText.isNotBlank()) add(ShareStat("Дистанция", rangeText))
            (item.data["duration"] as? JsonPrimitive)?.contentOrNull?.takeIf { it.isNotBlank() }?.let { add(ShareStat("Длительность", it)) }
            val components = obj("components")
            val signs = listOf("v" to "В", "s" to "С", "m" to "М").filter { (components?.get(it.first) as? JsonPrimitive)?.booleanOrNull == true }.joinToString(" · ") { it.second }
            if (signs.isNotBlank()) add(ShareStat("Компоненты", signs))
        }
    }
    fun collect(fields: JsonArray, data: JsonObject): List<ShareStat> = fields.filterIsInstance<JsonObject>().flatMap { field ->
        val value = data[field.text("key")]
        if (field.text("type") == "object" && value is JsonObject) collect(field["fields"] as? JsonArray ?: JsonArray(emptyList()), value)
        else {
            val text = readableValue(value, field, metadata)
            if (field.text("type") in setOf("description", "text", "textarea", "blocks", "image", "model", "svg", "item", "item_array", "object_array") || text.isBlank() || text.length > 100) emptyList()
            else listOf(ShareStat(field.text("name").ifBlank { field.text("label") }, text))
        }
    }
    return collect(fields, item.data).take(9)
}

internal fun rowIdentity(item: CatalogueItem, type: ItemType?, metadata: HandbookMetadata): Triple<String, String, List<String>> {
    val data = item.data
    val metric = when (item.typeId) {
        5L -> (data["lvl"] as? JsonPrimitive)?.content?.let { if (it == "0") "—" else it }.orEmpty()
        6L -> ((data["identity"] as? JsonObject)?.get("cr") as? JsonPrimitive)?.content.orEmpty()
        else -> ""
    }
    val subtitle = itemStats(type, item, metadata).filter { it.label.isNotBlank() }.take(2).joinToString(" · ") { it.value }
    val badges = buildList {
        if ((data["concentration"] as? JsonPrimitive)?.booleanOrNull == true) add("К")
        if ((data["ritual"] as? JsonPrimitive)?.booleanOrNull == true) add("Р")
    }
    return Triple(metric, subtitle, badges)
}

internal fun filterChoices(field: JsonObject, metadata: HandbookMetadata): List<Pair<JsonElement, String>> {
    if (field.text("type") in setOf("bool", "boolean")) return listOf(JsonPrimitive(true) to "Да", JsonPrimitive(false) to "Нет")
    if (field.text("type") in setOf("suggest", "suggest_array")) {
        val id = listOf("suggest_id", "suggest_type_id", "suggestTypeId").firstNotNullOfOrNull { (field[it] as? JsonPrimitive)?.content }
        return metadata.suggests[id].orEmpty().map { JsonPrimitive(it.id) to it.value }
    }
    val choices = (field["filter_values"] ?: field["options"]) as? JsonArray ?: return emptyList()
    return choices.mapNotNull { option ->
        if (option is JsonObject) option["value"]?.let { it to option.text("label").ifBlank { option.text("name") } }
        else option to ((field["filter_labels"] as? JsonObject)?.get((option as? JsonPrimitive)?.content)?.jsonPrimitive?.content
            ?: (option as? JsonPrimitive)?.content.orEmpty())
    }
}
