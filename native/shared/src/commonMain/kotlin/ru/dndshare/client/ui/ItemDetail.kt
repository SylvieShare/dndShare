package ru.dndshare.client.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import kotlinx.serialization.json.*
import ru.dndshare.client.data.CacheDao
import ru.dndshare.client.model.*

@Composable
fun ItemDetail(cache: CacheDao, sourceId: Long, id: Long, metadata: HandbookMetadata,
    images: ImageLoader, back: () -> Unit, open: (Long) -> Unit) {
    val payload by produceState<String?>(null, sourceId, id) {
        cache.observeItem(sourceId, id).collect { value = it }
    }
    val item = remember(payload) { payload?.let { WireJson.decodeFromString<CatalogueItem>(it) } }
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        TextButton(onClick = back) { AppGlyph(Glyph.Back); Spacer(Modifier.width(8.dp)); Text("Назад") }
        if (item == null) EmptyContent("Запись недоступна", "Она могла быть удалена или ещё не загрузилась.")
        else key(id) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 4.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text(item.name, style = MaterialTheme.typography.headlineMedium)
                item.nameEn?.takeIf(String::isNotBlank)?.let {
                    Text(it, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                val image = item.coverImageUrl ?: item.iconImageUrl
                if (image != null) AsyncImage(model = image, imageLoader = images,
                    contentDescription = item.name, contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxWidth().heightIn(max = 280.dp))
                val type = metadata.types.firstOrNull { it.id == item.typeId }
                type?.let { Text(it.name, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary) }
                SchemaFields(type?.fields as? JsonArray ?: JsonArray(emptyList()), item.data, metadata, cache, sourceId, open)
                if (item.contentSources.isNotEmpty()) {
                    HorizontalDivider()
                    Text("Источники", style = MaterialTheme.typography.titleSmall)
                    Text(item.contentSources.joinToString("\n") { it.name }, style = MaterialTheme.typography.bodySmall)
                }
                Spacer(Modifier.height(20.dp))
            }
        }
    }
}

@Composable
private fun SchemaFields(fields: JsonArray, data: JsonObject, metadata: HandbookMetadata,
    cache: CacheDao, sourceId: Long, open: (Long) -> Unit, depth: Int = 0) {
    if (depth > 8) return
    for (schema in fields) {
        val field = schema as? JsonObject ?: continue
        val key = field.text("key")
        val value = data[key]?.takeUnless { it is JsonNull } ?: continue
        if (field.text("type") in setOf("image", "model", "svg") || key in setOf("icon", "cover", "models")) continue
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
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            val title = field.text("name").ifBlank { field.text("label") }
            if (title.isNotBlank()) Text(title, style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            when (field.text("type")) {
                "object" -> (value as? JsonObject)?.let {
                    SchemaFields(field["fields"] as? JsonArray ?: JsonArray(emptyList()), it, metadata, cache, sourceId, open, depth + 1)
                }
                "object_array" -> (value as? JsonArray)?.forEachIndexed { index, row ->
                    if (index > 0) HorizontalDivider()
                    (row as? JsonObject)?.let {
                        SchemaFields(field["fields"] as? JsonArray ?: JsonArray(emptyList()), it, metadata, cache, sourceId, open, depth + 1)
                    }
                }
                "item", "item_array" -> {
                    val refs = if (value is JsonArray) value else listOf(value)
                    refs.forEach { ref ->
                        val refId = (if (ref is JsonObject) ref["id"] else ref)?.jsonPrimitive?.longOrNull
                        if (refId != null && refId > 0) ItemReference(cache, sourceId, refId, open)
                    }
                }
                "blocks" -> (value as? JsonArray)?.forEach { block ->
                    (block as? JsonObject)?.let {
                        if (it.text("name").isNotBlank()) Text(it.text("name"), style = MaterialTheme.typography.titleSmall)
                        RichDescription(it.text("desc"), openItem = open)
                    }
                }
                "int_by_suggest" -> (value as? JsonObject)?.forEach { (id, amount) ->
                    Text("${(amount as? JsonPrimitive)?.content.orEmpty()} ${id.toLongOrNull()?.let { metadata.suggest(it)?.value }.orEmpty()}")
                }
                "description", "text", "textarea" -> RichDescription((value as? JsonPrimitive)?.contentOrNull.orEmpty(), openItem = open)
                else -> FieldValue(value, field, metadata, open)
            }
        }
    }
}

@Composable
private fun ItemReference(cache: CacheDao, sourceId: Long, id: Long, open: (Long) -> Unit) {
    val name by produceState<String?>(null, sourceId, id) {
        cache.observeItem(sourceId, id).collect { payload ->
            value = payload?.let { WireJson.decodeFromString<CatalogueItem>(it).name }
        }
    }
    TextButton(onClick = { open(id) }, enabled = name != null, contentPadding = PaddingValues(0.dp)) {
        Text(name ?: "Связанная запись недоступна")
    }
}

@Composable
private fun FieldValue(value: JsonElement, field: JsonObject, metadata: HandbookMetadata, open: (Long) -> Unit) {
    val values = if (value is JsonArray) value else listOf(value)
    val text = values.mapNotNull { element ->
        val primitive = element as? JsonPrimitive ?: return@mapNotNull null
        when {
            primitive.booleanOrNull != null -> if (primitive.boolean) "Да" else "Нет"
            field.text("type") in setOf("select", "enum_array") -> {
                (field["options"] as? JsonArray)?.mapNotNull { it as? JsonObject }
                    ?.firstOrNull { it["value"] == primitive }?.text("label") ?: primitive.content
            }
            field.text("type") in setOf("suggest", "suggest_array") -> {
                primitive.longOrNull?.let { metadata.suggest(it)?.value } ?: primitive.content
            }
            else -> primitive.content
        }
    }.joinToString(", ")
    if (text.isNotBlank()) RichDescription(text, openItem = open)
}
