package ru.dndshare.client.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.catch
import kotlinx.serialization.json.*
import ru.dndshare.client.data.CacheDao
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

val LocalCatalogueEditions = staticCompositionLocalOf { emptyList<Edition>() }

internal data class ItemRecordState(
    val item: CatalogueItem?,
    val resolved: Boolean,
    val error: String? = null,
    val retry: () -> Unit = {},
)

@Composable
internal fun rememberItemRecord(
    cache: CacheDao,
    sourceId: Long,
    id: Long,
    initial: CatalogueItem? = null,
): ItemRecordState {
    val known = remember(cache, sourceId) { mutableMapOf<Long, CatalogueItem>() }
    var attempt by remember(sourceId, id) { mutableIntStateOf(0) }
    val seed = initial?.takeIf { it.id == id } ?: known[id]
    val state by
        key(sourceId, id, attempt) {
            produceState(ItemRecordState(seed, seed != null), cache, sourceId, id) {
                cache
                    .observeItem(sourceId, id)
                    .catch { error ->
                        if (error is CancellationException) throw error
                        value = ItemRecordState(value.item, true, "Не удалось прочитать запись.")
                    }
                    .collect { payload ->
                        val record = payload?.let {
                            runCatching { WireJson.decodeFromString<CatalogueItem>(it) }.getOrNull()
                        }
                        if (record != null) known[id] = record else known.remove(id)
                        value = ItemRecordState(record, true)
                    }
            }
        }
    return state.copy(retry = { attempt++ })
}

@Composable
fun ItemDetail(
    cache: CacheDao,
    sourceId: Long,
    id: Long,
    metadata: HandbookMetadata,
    images: ImageLoader,
    back: () -> Unit,
    open: (Long) -> Unit,
) {
    val state = rememberItemRecord(cache, sourceId, id)
    Box(Modifier.fillMaxSize().padding(LocalChromePadding.current)) {
        ItemRecordView(state, cache, sourceId, metadata, images, open, pageBack = back)
    }
}

@Composable
internal fun ItemRecordView(
    state: ItemRecordState,
    cache: CacheDao?,
    sourceId: Long,
    metadata: HandbookMetadata,
    images: ImageLoader,
    open: (Long) -> Unit,
    headerInset: Int = 0,
    pageBack: (() -> Unit)? = null,
) {
    val saved = rememberSaveableStateHolder()
    when {
        !state.resolved ->
            Column(
                Modifier.fillMaxWidth().padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                ShareSkeletonBlock(Modifier.fillMaxWidth().height(240.dp))
                repeat(3) { ShareSkeletonBlock(Modifier.fillMaxWidth().height(32.dp)) }
            }
        state.item == null ->
            Column(
                Modifier.fillMaxWidth().padding(28.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text("Запись недоступна", style = ShareTypography.header)
                Text(
                    state.error
                        ?: "Она могла быть удалена, скрыта или ещё не загружена. Готовые записи доступны без сети.",
                    color = WebPalette.TextMuted,
                )
                ShareAction("Повторить", state.retry)
            }
        else ->
            saved.SaveableStateProvider(state.item.id) {
                val item = state.item
                val type = metadata.types.firstOrNull { it.id == item.typeId }
                Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState())) {
                    ItemDetailCover(item, type, metadata, images, headerInset, pageBack)
                    Column(
                        Modifier.padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(18.dp),
                    ) {
                        val editions = LocalCatalogueEditions.current
                        val rules =
                            item.compatibility
                                .mapNotNull { compatibility ->
                                    editions
                                        .firstOrNull { it.id == compatibility.sourceVersionId }
                                        ?.let {
                                            it.version +
                                                when (compatibility.status) {
                                                    "legacy" -> " (наследие)"
                                                    "requires_adaptation" -> " (адаптация)"
                                                    else -> ""
                                                }
                                        }
                                }
                                .distinct()
                        if (rules.isNotEmpty())
                            Text(
                                "Правила: " + rules.joinToString(" · "),
                                style = ShareTypography.context,
                                color = WebPalette.TextMuted,
                            )
                        CompositionLocalProvider(
                            LocalRichDescriptionStyle provides
                                ShareTypography.itemDescription.copy(
                                    color = WebPalette.TextSecondary
                                )
                        ) {
                            ItemRecordBody(item, type, metadata, cache, sourceId, open)
                        }
                        if (item.contentSources.isNotEmpty())
                            ShareDetailSection("Источники") {
                                item.contentSources.forEach {
                                    Text(
                                        it.name,
                                        style = ShareTypography.context,
                                        color = WebPalette.TextSecondary,
                                    )
                                }
                            }
                        Text(
                            "ID: ${item.id}",
                            style = ShareTypography.context,
                            color = WebPalette.TextMuted,
                        )
                    }
                }
            }
    }
}

@Composable
private fun ItemRecordBody(
    item: CatalogueItem,
    type: ItemType?,
    metadata: HandbookMetadata,
    cache: CacheDao?,
    sourceId: Long,
    open: (Long) -> Unit,
) {
    val fields = (type?.fields as? JsonArray).orEmpty()
    val summarized = catalogueSummary(item, type, metadata).keys
    val completeFields =
        fields.filterIsInstance<JsonObject>().filter { field ->
            val value = item.data[field.text("key")]
            field.text("key") in summarized &&
                (value is JsonObject && value.isNotEmpty() ||
                    value is JsonArray && value.isNotEmpty())
        }
    val content =
        fields
            .filterIsInstance<JsonObject>()
            .filter { it.text("key") !in summarized }
            .map { field ->
                if (item.typeId == 5L && field.text("key") in setOf("desc", "description"))
                    JsonObject(field + mapOf("name" to JsonPrimitive("Описание заклинания")))
                else field
            }
    if (content.isEmpty() || cache == null) {
        val html =
            item.data.text("desc").ifBlank {
                item.data.text("description").ifBlank { item.data.text("notes") }
            }
        if (html.isNotBlank())
            ShareDetailSection("Описание") { RichDescription(html, openItem = open) }
        else if (content.isEmpty()) Text("Описание отсутствует", color = WebPalette.TextMuted)
    }
    if (cache != null) SchemaFields(JsonArray(content), item.data, metadata, cache, sourceId, open)
    if (cache != null && completeFields.isNotEmpty())
        ShareDetailSection("Полные характеристики", collapsible = true, defaultOpen = false) {
            SchemaFields(JsonArray(completeFields), item.data, metadata, cache, sourceId, open)
        }
}
