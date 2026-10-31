package ru.dndshare.client.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.data.CacheDao
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SchemaFields(
    fields: JsonArray,
    data: JsonObject,
    metadata: HandbookMetadata,
    cache: CacheDao,
    sourceId: Long,
    open: (Long) -> Unit,
    depth: Int = 0,
) {
    if (depth > 8) return
    for (schema in fields) {
        val field = schema as? JsonObject ?: continue
        val key = field.text("key")
        val value = data[key]?.takeUnless { it is JsonNull } ?: continue
        if (
            field.text("type") in setOf("image", "model", "svg") ||
                key in setOf("icon", "cover", "models")
        )
            continue
        val visibleWhen = field["show_on"] as? JsonObject
        if (visibleWhen != null) {
            val actual = data[visibleWhen.text("key")]
            val expected = visibleWhen["value"]
            val actuals = if (actual is JsonArray) actual else listOf(actual)
            val expectedValues = if (expected is JsonArray) expected else listOf(expected)
            if (actuals.none { it in expectedValues }) continue
        }
        if (value is JsonPrimitive && value.contentOrNull.isNullOrBlank()) continue
        if (value is JsonArray && value.isEmpty()) continue
        val title = field.text("name").ifBlank { field.text("label") }
        ShareDetailSection(title) {
            when (field.text("type")) {
                "object" ->
                    (value as? JsonObject)?.let {
                        SchemaFields(
                            field["fields"] as? JsonArray ?: JsonArray(emptyList()),
                            it,
                            metadata,
                            cache,
                            sourceId,
                            open,
                            depth + 1,
                        )
                    }
                "object_array" ->
                    (value as? JsonArray)?.forEachIndexed { index, row ->
                        if (index > 0) HorizontalDivider()
                        (row as? JsonObject)?.let {
                            SchemaFields(
                                field["fields"] as? JsonArray ?: JsonArray(emptyList()),
                                it,
                                metadata,
                                cache,
                                sourceId,
                                open,
                                depth + 1,
                            )
                        }
                    }
                "item",
                "item_array" -> {
                    val refs = if (value is JsonArray) value else listOf(value)
                    refs.forEach { ref ->
                        val refId =
                            (if (ref is JsonObject) ref["id"] else ref)?.jsonPrimitive?.longOrNull
                        if (refId != null && refId > 0) ItemReference(cache, sourceId, refId, open)
                    }
                }
                "blocks" ->
                    (value as? JsonArray)?.forEach { block ->
                        (block as? JsonObject)?.let {
                            if (it.text("name").isNotBlank())
                                Text(it.text("name"), style = MaterialTheme.typography.titleSmall)
                            RichDescription(it.text("value"), openItem = open)
                        }
                    }
                "dice" -> {
                    val primitive = value as? JsonPrimitive
                    val label =
                        primitive?.longOrNull?.let { metadata.suggest(it, 1)?.value }
                            ?: primitive?.contentOrNull.orEmpty()
                    val sides = label.filter(Char::isDigit).toIntOrNull()
                    if (sides in setOf(4, 6, 8, 10, 12, 20, 100))
                        ShareDie(requireNotNull(sides), sides.toString())
                    else Text(label.ifBlank { "—" })
                }
                "int_by_suggest" ->
                    (value as? JsonObject)?.let { amount ->
                        val unit =
                            (amount["suggest_id"] as? JsonPrimitive)
                                ?.longOrNull
                                ?.let { metadata.suggest(it, suggestTypeId(field))?.value }
                                .orEmpty()
                        Text("${(amount["value"] as? JsonPrimitive)?.content.orEmpty()} $unit")
                    }
                "description",
                "text",
                "textarea" ->
                    RichDescription(
                        (value as? JsonPrimitive)?.contentOrNull.orEmpty(),
                        openItem = open,
                    )
                else -> FieldValue(value, field, metadata, open)
            }
        }
    }
}

@Composable
private fun ItemReference(cache: CacheDao, sourceId: Long, id: Long, open: (Long) -> Unit) {
    val name by
        produceState<String?>(null, sourceId, id) {
            cache.observeItem(sourceId, id).collect { payload ->
                value = payload?.let { WireJson.decodeFromString<CatalogueItem>(it).name }
            }
        }
    ShareTextButton(
        onClick = { open(id) },
        enabled = name != null,
        contentPadding = PaddingValues(0.dp),
    ) {
        Text(name ?: "Связанная запись недоступна")
    }
}

@Composable
private fun FieldValue(
    value: JsonElement,
    field: JsonObject,
    metadata: HandbookMetadata,
    open: (Long) -> Unit,
) {
    val values = if (value is JsonArray) value else listOf(value)
    val text =
        values
            .mapNotNull { element ->
                val primitive = element as? JsonPrimitive ?: return@mapNotNull null
                when {
                    primitive.booleanOrNull != null -> if (primitive.boolean) "Да" else "Нет"
                    field.text("type") in setOf("select", "enum_array") -> {
                        (field["options"] as? JsonArray)
                            ?.mapNotNull { it as? JsonObject }
                            ?.firstOrNull { it["value"] == primitive }
                            ?.text("label") ?: primitive.content
                    }
                    field.text("type") in setOf("suggest", "suggest_array") -> {
                        primitive.longOrNull?.let {
                            metadata.suggest(it, suggestTypeId(field))?.value
                        } ?: primitive.content
                    }
                    else -> primitive.content
                }
            }
            .joinToString(", ")
    if (text.isNotBlank()) RichDescription(text, openItem = open)
}
