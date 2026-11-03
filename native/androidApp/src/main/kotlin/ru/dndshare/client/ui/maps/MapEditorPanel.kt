package ru.dndshare.client.ui.maps

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.ImageLoader
import ru.dndshare.client.maps.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapEditorPanel(workspace: MapEditorWorkspace, images: ImageLoader) {
    val tab = workspace.ui.panel
    Column(
        Modifier.fillMaxSize().padding(14.dp).semantics { paneTitle = "Инструменты карты: $tab" },
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                mapOf(
                        "tiles" to "Плитки",
                        "objects" to "Объекты",
                        "decals" to "Декали",
                        "lights" to "Освещение",
                        "areas" to "Области",
                        "cameras" to "Камеры",
                        "settings" to "Настройки",
                        "performance" to "Производительность",
                    )[tab]
                    .orEmpty(),
                Modifier.weight(1f),
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
            )
            MapToolButton("Свернуть панель", Glyph.Collapse) {
                workspace.controller.ui { it.copy(sidebarOpen = false) }
            }
        }
        key(tab) {
            when (tab) {
                "tiles",
                "objects" ->
                    Box(Modifier.weight(1f)) {
                        MapModelPalette(
                            workspace,
                            images,
                            tab == "objects",
                            choose = { workspace.placement.tool(MapTool.Model(it.uuid)) },
                        )
                    }
                "decals" -> Box(Modifier.weight(1f)) { MapDecalPalette(workspace, images) }
                else ->
                    Column(
                        Modifier.weight(1f).verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(25.dp),
                    ) {
                        when (tab) {
                            "settings" -> MapPropertiesPanel(workspace, workspace.api)
                            "lights" -> MapLightingPanel(workspace, images)
                            "areas" -> MapAreasList(workspace, images)
                            "cameras" -> MapCamerasList(workspace, images)
                            "performance" -> MapPerformancePanel(workspace)
                        }
                    }
            }
        }
    }
}
