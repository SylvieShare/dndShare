package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import ru.dndshare.client.character.*
import ru.dndshare.client.data.CacheDao
import ru.dndshare.client.data.searchPattern
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SheetItemPicker(
    cache: CacheDao,
    sheet: CharacterSheet,
    types: List<Long>,
    close: () -> Unit,
    eligibility: (CatalogueItem) -> List<String> = { emptyList() },
    select: (CatalogueItem) -> Unit,
) {
    val context = LocalCharacterSheet.current
    var query by rememberSaveable { mutableStateOf("") }
    var type by rememberSaveable { mutableStateOf(types.first()) }
    var count by remember { mutableIntStateOf(100) }
    val rows by
        produceState<List<CatalogueItem>?>(
            null,
            cache,
            sheet.sourceId,
            sheet.sourceVersionId,
            query,
            type,
            count,
        ) {
            val settings = sheet.data["settings"].objectValue()["contentSources"].objectValue()
            cache
                .observeCharacterItems(
                    sheet.sourceId,
                    type,
                    sheet.sourceVersionId ?: 0,
                    settings["allowLegacy"] == kotlinx.serialization.json.JsonPrimitive(true),
                    settings.text("mode") == "selected",
                    (settings["ids"] ?: kotlinx.serialization.json.JsonArray(emptyList()))
                        .toString(),
                    searchPattern(query),
                    count,
                )
                .collect {
                    value = it.map { row -> WireJson.decodeFromString<CatalogueItem>(row.payload) }
                }
        }
    ShareWindow(
        onDismissRequest = close,
        title = { Text("Справочник", style = ShareTypography.header) },
        scrollContent = false,
    ) {
        ShareSearch(
            query,
            {
                query = it
                count = 100
            },
        )
        if (types.size > 1)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                types.forEach { id ->
                    ShareChoiceChip(
                        type == id,
                        {
                            type = id
                            count = 100
                        },
                        label = {
                            Text(
                                context.metadata.types.firstOrNull { it.id == id }?.name
                                    ?: "Коллекция $id"
                            )
                        },
                    )
                }
            }
        if (rows == null) CircularProgressIndicator()
        else
            LazyColumn(
                Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (rows.isNullOrEmpty())
                    item {
                        SheetEmpty(
                            "Ничего не найдено. Проверьте синхронизацию справочника и редакцию."
                        )
                    }
                items(rows.orEmpty(), key = { it.id }) { item ->
                    val reasons = eligibility(item)
                    ShareTile(
                        onClick = if (reasons.isEmpty()) ({ select(item) }) else null,
                        framed = false,
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            item.iconImageUrl?.let {
                                AsyncImage(
                                    it,
                                    null,
                                    imageLoader = context.images,
                                    modifier = Modifier.size(48.dp),
                                )
                            }
                            Column(Modifier.weight(1f)) {
                                Text(item.name, style = ShareTypography.group)
                                item.nameEn?.let {
                                    Text(
                                        it,
                                        style = ShareTypography.context,
                                        color = WebPalette.TextMuted,
                                    )
                                }
                                reasons.forEach {
                                    Text(
                                        it,
                                        style = ShareTypography.context,
                                        color = WebPalette.Warning,
                                    )
                                }
                            }
                        }
                    }
                }
                if (rows.orEmpty().size >= count)
                    item { ShareTextButton(onClick = { count += 100 }) { Text("Показать ещё") } }
            }
    }
}
