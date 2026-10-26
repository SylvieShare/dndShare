package ru.dndshare.client.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import ru.dndshare.client.app.AppController
import ru.dndshare.client.app.AppState

@Composable
internal fun AppHeader(format: LayoutFormat, page: AppPage, state: AppState, controller: AppController, openMenu: () -> Unit) {
    Surface(color = WebPalette.Background) {
        Column {
            Row(Modifier.fillMaxWidth().heightIn(min = 64.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                if (format == LayoutFormat.Phone) IconButton(onClick = openMenu,
                    modifier = Modifier.semantics { contentDescription = "Открыть меню" }) { AppGlyph(Glyph.Menu) }
                Column(Modifier.weight(1f).padding(horizontal = 8.dp, vertical = 8.dp)) {
                    Text(page.title, style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    val source = state.sources.firstOrNull { it.id == state.sourceId }
                    val edition = source?.versions?.firstOrNull { it.id == state.editionId }
                    if (source != null) Text(listOfNotNull(source.name, edition?.version).joinToString(" · "),
                        style = MaterialTheme.typography.labelSmall, color = WebPalette.TextSecondary, maxLines = 1)
                }
                if (page == AppPage.Handbook || page == AppPage.Characters) IconButton(
                    onClick = { controller.refresh(force = true) }, enabled = !state.synchronizing,
                    modifier = Modifier.semantics { contentDescription = "Обновить" },
                ) { AppGlyph(Glyph.Refresh) }
            }
            HorizontalDivider()
        }
    }
}

@Composable
internal fun SourcePicker(state: AppState, controller: AppController) {
    var expanded by remember { mutableStateOf(false) }
    val source = state.sources.firstOrNull { it.id == state.sourceId }
    val edition = source?.versions?.firstOrNull { it.id == state.editionId }
    Box {
        TextButton(onClick = { expanded = true }, enabled = state.sources.isNotEmpty(), modifier = Modifier.fillMaxWidth()) {
            Text(listOfNotNull(source?.name, edition?.version).joinToString(" · ").ifEmpty { "Игровая система" },
                maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            Text("  ⌄")
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            for (item in state.sources) {
                if (item.versions.isEmpty()) DropdownMenuItem(
                    text = { Text(item.name) },
                    onClick = { expanded = false; controller.selectSource(item, null) },
                )
                for (version in item.versions) DropdownMenuItem(
                    text = { Text(item.name + " · " + version.version) },
                    onClick = { expanded = false; controller.selectSource(item, version) },
                )
            }
        }
    }
}
