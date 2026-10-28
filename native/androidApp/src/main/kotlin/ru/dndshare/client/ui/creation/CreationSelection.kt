package ru.dndshare.client.ui.creation

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import ru.dndshare.client.character.*
import ru.dndshare.client.character.creation.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.RichDescription
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun CreationSelection(
    title: String,
    candidates: List<CatalogueItem>,
    selected: CatalogueItem?,
    images: ImageLoader,
    related: List<CatalogueItem> = candidates,
    choose: (Long) -> Unit,
) {
    var query by rememberSaveable(title) { mutableStateOf("") }
    var browsing by rememberSaveable(title, selected?.id) { mutableStateOf(selected == null) }
    var shown by rememberSaveable(title) { mutableIntStateOf(24) }
    var detail by remember { mutableStateOf<CatalogueItem?>(null) }
    Text(title, style = ShareTypography.section)
    if (selected != null && !browsing) {
        CreationChoiceCard(selected, true, images, {}, { detail = selected })
        ShareTextButton(onClick = { browsing = true }) { Text("Выбрать другой вариант") }
    } else {
        ShareSearch(
            query,
            {
                query = it
                shown = 24
            },
            placeholder = "Поиск",
        )
        val rows = candidates.filter {
            it.name.contains(query, true) || it.nameEn.orEmpty().contains(query, true)
        }
        ShareBalancedColumns(minimumWidth = 340.dp, maxColumns = 2) {
            rows.take(shown).forEach { item ->
                key(item.id) {
                    CreationChoiceCard(
                        item,
                        selected?.id == item.id,
                        images,
                        {
                            choose(item.id)
                            browsing = false
                        },
                        { detail = item },
                    )
                }
            }
        }
        if (rows.isEmpty())
            Text(
                "Подходящих вариантов нет. Проверьте редакцию и выбранные книги.",
                style = ShareTypography.context,
            )
        if (rows.size > shown) ShareTextButton(onClick = { shown += 24 }) { Text("Показать ещё") }
    }
    detail?.let { item ->
        ShareFormDialog(item.name, { detail = null }) {
            item.coverImageUrl?.let {
                AsyncImage(
                    it,
                    null,
                    imageLoader = images,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxWidth().height(240.dp),
                )
            }
            RichDescription(
                item.data.text("desc").ifBlank { item.data.text("description") },
                openItem = { id -> related.firstOrNull { it.id == id }?.let { detail = it } },
            )
        }
    }
}

@Composable
private fun CreationChoiceCard(
    item: CatalogueItem,
    selected: Boolean,
    images: ImageLoader,
    choose: () -> Unit,
    detail: () -> Unit,
) {
    ShareTile(
        onClick = choose,
        framed = false,
        accent = if (selected) WebPalette.Accent else null,
        contentPadding = PaddingValues(0.dp),
    ) {
        item.coverImageUrl?.let {
            AsyncImage(
                it,
                null,
                imageLoader = images,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().height(if (selected) 150.dp else 160.dp),
            )
        }
        Row(
            Modifier.fillMaxWidth().padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (item.coverImageUrl == null)
                Box(Modifier.size(48.dp), contentAlignment = Alignment.Center) {
                    Text(
                        item.name.take(1),
                        style = ShareTypography.title,
                        color = WebPalette.AccentSoft,
                    )
                }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(item.name, style = ShareTypography.card)
                item.nameEn?.let {
                    Text(it, style = ShareTypography.context, color = WebPalette.TextMuted)
                }
            }
            ShareTextButton(onClick = detail) { Text("Подробнее") }
        }
    }
}

@Composable
internal fun CreationChoiceRows(
    rows: List<CreationChoice>,
    draft: CreationDraft,
    choose: (String, String, Int) -> Unit,
) {
    rows.forEach { row ->
        ShareTile(framed = false) {
            Text(
                "${row.title} · ${draft.choices[row.key].orEmpty().size}/${row.count}",
                style = ShareTypography.group,
            )
            row.invalidOptions.values.distinct().forEach {
                Text(it, style = ShareTypography.context, color = WebPalette.TextMuted)
            }
            var query by rememberSaveable(row.key) { mutableStateOf("") }
            if (row.options.size > 20)
                ShareSearch(query, { query = it }, placeholder = "Найти вариант")
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                row.options
                    .filter { it.second.contains(query, true) }
                    .forEach { (value, label) ->
                        val selected = value in draft.choices[row.key].orEmpty()
                        ShareChoiceChip(
                            selected,
                            { choose(row.key, value, row.count) },
                            label = { Text(label) },
                            enabled =
                                selected ||
                                    (value !in row.invalidOptions &&
                                        (draft.choices[row.key].orEmpty().size < row.count ||
                                            row.count == 1)),
                        )
                    }
            }
        }
    }
}
