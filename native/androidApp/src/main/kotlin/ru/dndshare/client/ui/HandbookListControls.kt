package ru.dndshare.client.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.model.text
import ru.dndshare.designsystem.*

@Composable
internal fun HandbookListControls(query: String, search: (String) -> Unit, groupBy: String, group: (String) -> Unit,
    fields: List<JsonObject>, filtered: Boolean, filters: () -> Unit, hasFilters: Boolean) {
    Column {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ShareSearch(query, search, modifier = Modifier.weight(1f), placeholder = "Поиск по названию — RU / EN…")
            if (hasFilters || filtered) ShareAction("Фильтры", filters, active = filtered, icon = Glyph.Filter)
        }
        if (fields.isNotEmpty()) Surface(color = WebPalette.Surface) {
            FlowRow(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("ГРУППИРОВАТЬ СПИСОК", Modifier.align(Alignment.CenterVertically),
                    style = MaterialTheme.typography.labelSmall, color = WebPalette.TextMuted)
                fields.forEach { field ->
                    FilterChip(selected = groupBy == field.text("key"),
                        onClick = { group(if (groupBy == field.text("key")) "" else field.text("key")) },
                        label = { Text(field.text("nameShort").ifBlank { field.text("name") }) })
                }
            }
        }
    }
}
