package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SheetCatalogueEntry(reference: JsonElement, expanded: Boolean = true) {
    val context = LocalCharacterSheet.current
    val entry = reference.objectValue()
    val id = (entry["item_id"] ?: entry["id"])?.jsonPrimitive?.longOrNull
    val item = context.items[id]
    val title = entry["override"].objectValue().text("name").ifBlank { entry.label() }.ifBlank { item?.name ?: "Запись недоступна офлайн" }
    ShareTile(Modifier.fillMaxWidth(), onClick = id?.let { { context.openItem(it) } }) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            item?.iconImageUrl?.let { AsyncImage(it, null, imageLoader = context.images, modifier = Modifier.size(64.dp)) }
            Text(title, Modifier.weight(1f), style = ShareTypography.card)
            entry["count"]?.let { if (it.number() != 1) Text("×${it.number()}", color = WebPalette.AccentSoft) }
        }
        if (expanded) {
            val description = entry.text("desc").ifBlank { item?.data?.text("desc").orEmpty() }.ifBlank { item?.data?.text("description").orEmpty() }
            if (description.isNotBlank()) SheetDescription(description)
        }
    }
}

@Composable
internal fun SheetEmpty(label: String) {
    Text(label, Modifier.padding(vertical = 20.dp), style = ShareTypography.group, color = WebPalette.TextMuted)
}
