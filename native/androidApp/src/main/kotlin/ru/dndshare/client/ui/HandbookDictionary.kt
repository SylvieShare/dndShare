package ru.dndshare.client.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.dndshare.client.model.*
import ru.dndshare.designsystem.*

@Composable
internal fun HandbookDictionary(id: Long, metadata: HandbookMetadata, back: () -> Unit, open: (Long) -> Unit) {
    var query by rememberSaveable(id) { mutableStateOf("") }
    val dictionary = metadata.suggestTypes.firstOrNull { it.id == id }
    val entries = metadata.suggests[id.toString()].orEmpty().filter { it.value.contains(query, ignoreCase = true) }
    Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        ShareAction("Справочник", back, icon = Glyph.Back)
        Text(dictionary?.name ?: "Словарь", style = ShareTypography.title)
        ShareSearch(query, { query = it }, placeholder = "Поиск по словарю")
        LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(entries, key = { it.id }) { entry ->
                ShareTile(Modifier.fillMaxWidth()) {
                    Text(entry.value, style = ShareTypography.card, color = catalogueColor(entry.color))
                    entry.desc?.takeIf { it.isNotBlank() }?.let { RichDescription(it, openItem = open) }
                }
            }
            if (entries.isEmpty()) item { Text("Ничего не найдено", color = WebPalette.TextMuted) }
        }
    }
}
