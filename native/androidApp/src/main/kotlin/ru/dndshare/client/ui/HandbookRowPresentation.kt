package ru.dndshare.client.ui

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

internal data class HandbookRow(
    val metric: String, val subtitle: String, val badges: List<String>, val alternate: String,
    val imageUrl: String?, val trailing: String,
)

internal fun handbookRow(item: CatalogueItem, type: ItemType?, metadata: HandbookMetadata): HandbookRow {
    val data = item.data
    fun text(path: String) = (schemaPath(data, path) as? JsonPrimitive)?.content.orEmpty()
    fun suggest(path: String): String {
        val field = schemaLeaves(type?.fields as? JsonArray ?: JsonArray(emptyList())).firstOrNull { it.first == path }?.second
        return readableValue(schemaPath(data, path), field ?: JsonObject(emptyMap()), metadata)
    }
    val metric = when (item.typeId) { 5L -> text("lvl").takeUnless { it.isBlank() || it == "0" } ?: "—"; 6L -> text("combat.cr"); else -> "" }
    val subtitle = when (item.typeId) {
        5L -> listOf(suggest("schoolId"), *itemStats(type, item, metadata)
            .filter { it.label in setOf("Время", "Дистанция") }.map { it.value }.toTypedArray()).filter(String::isNotBlank).joinToString(" · ")
        6L -> listOf("identity.creature_type", "identity.size", "identity.alignment").map(::suggest).filter(String::isNotBlank).joinToString(" · ")
        else -> itemStats(type, item, metadata).take(2).joinToString(" · ") { it.value }
    }
    val badges = buildList { if (text("concentration") == "true") add("К"); if (text("ritual") == "true") add("Р") }
    val trailing = if (item.typeId == 6L) text("combat.hp").takeIf(String::isNotBlank)?.let { "♥ $it" }.orEmpty() else ""
    return HandbookRow(metric, subtitle, badges, item.nameEn.orEmpty().replace('_', ' ').split(' ').joinToString(" ") {
        it.replaceFirstChar { ch -> ch.uppercaseChar() }
    }, item.iconImageUrl ?: type?.iconImageUrl, trailing)
}
