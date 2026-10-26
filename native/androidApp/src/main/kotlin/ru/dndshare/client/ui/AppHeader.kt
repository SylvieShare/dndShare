package ru.dndshare.client.ui

import ru.dndshare.designsystem.*

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
internal fun AppHeader(
    format: LayoutFormat, page: AppPage, state: AppState, openMenu: () -> Unit,
    heading: (@Composable () -> Unit)? = null,
) {
    ShareWorkspaceHeader(contentInset = when (format) {
        LayoutFormat.Wide -> DesignTokens.Spacing.Page
        LayoutFormat.Phone -> DesignTokens.Spacing.Small
        else -> DesignTokens.Spacing.Large
    }) {
        if (format != LayoutFormat.Wide) IconButton(onClick = openMenu,
            modifier = Modifier.semantics { contentDescription = "Открыть меню" }) { AppGlyph(Glyph.Menu) }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            if (heading != null) heading()
            else Text(page.title, style = ShareTypography.header, maxLines = 1, overflow = TextOverflow.Ellipsis)
            val source = state.sources.firstOrNull { it.id == state.sourceId }
            val edition = source?.versions?.firstOrNull { it.id == state.editionId }
            if (source != null && format != LayoutFormat.Wide) Text(
                listOfNotNull(sourceLabel(source.name), edition?.version).joinToString(" · "),
                style = ShareTypography.context, color = WebPalette.TextSecondary, maxLines = 1)
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
            Text(listOfNotNull(source?.name?.let(::sourceLabel), edition?.version).joinToString(" · ").ifEmpty { "Игровая система" },
                maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            Text("  ⌄")
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            for (item in state.sources) {
                if (item.versions.isEmpty()) DropdownMenuItem(
                    text = { Text(sourceLabel(item.name)) },
                    onClick = { expanded = false; controller.selectSource(item, null) },
                )
                for (version in item.versions) DropdownMenuItem(
                    text = { Text(sourceLabel(item.name) + " · " + version.version) },
                    onClick = { expanded = false; controller.selectSource(item, version) },
                )
            }
        }
    }
}

private fun sourceLabel(name: String): String = when (name.lowercase()) {
    "dnd5e" -> "D&D 5e"
    "vampire: tm" -> "Vampire"
    else -> name
}
