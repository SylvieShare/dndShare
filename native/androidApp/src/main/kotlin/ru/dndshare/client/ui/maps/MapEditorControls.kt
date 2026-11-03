package ru.dndshare.client.ui.maps

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapToolButton(label: String, glyph: Glyph, enabled: Boolean = true, run: () -> Unit) {
    IconButton(
        run,
        enabled = enabled,
        modifier = Modifier.semantics { contentDescription = label },
    ) {
        AppGlyph(glyph)
    }
}

@Composable
internal fun MapToolRail(tab: String, select: (String) -> Unit, modifier: Modifier) {
    Column(
        modifier
            .fillMaxHeight()
            .background(WebPalette.Surface)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        listOf(
                Triple("tiles", "Плитки", Glyph.Layers),
                Triple("objects", "Объекты", Glyph.Box),
                Triple("decals", "Декали", Glyph.Sticker),
                Triple("lights", "Освещение", Glyph.Lightbulb),
                Triple("areas", "Области", Glyph.Group),
                Triple("cameras", "Камеры", Glyph.Camera),
                Triple("settings", "Настройки", Glyph.Settings),
                Triple("performance", "Нагрузка", Glyph.Gauge),
            )
            .forEach { (key, title, icon) ->
                Surface(
                    { select(key) },
                    Modifier.size(64.dp).semantics {
                        contentDescription = title
                        role = Role.Tab
                        selected = tab == key
                    },
                    color = if (tab == key) WebPalette.Subheader else WebPalette.Surface,
                    shape = MaterialTheme.shapes.medium,
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        AppGlyph(icon)
                        Text(title, style = ShareTypography.context, maxLines = 1)
                    }
                }
            }
    }
}
