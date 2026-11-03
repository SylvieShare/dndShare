package ru.dndshare.client.ui.maps

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapLibraryPreview(
    c: MapLibraryController,
    cache: MapAssetCache,
    store: MapWorkspaceStore,
) {
    val map = c.preview ?: return
    var models by remember { mutableStateOf<List<MapModel>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var failure by remember { mutableStateOf<String?>(null) }
    var retry by remember { mutableIntStateOf(0) }
    var scene by remember { mutableStateOf<FilamentMapScene?>(null) }
    LaunchedEffect(retry) {
        loading = true
        failure = null
        try {
            models = store.models().orEmpty()
            if (models.isNotEmpty()) loading = false
            models = c.api.models()
            store.models(models)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            failure = error.message ?: "Не удалось загрузить модели"
        } finally {
            loading = false
        }
    }
    ShareFullscreenDialog({ c.preview = null }) {
        Column(
            Modifier.fillMaxSize()
                .background(WebPalette.Background)
                .windowInsetsPadding(WindowInsets.safeDrawing)
        ) {
            Row(
                Modifier.fillMaxWidth().padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(map.name, Modifier.weight(1f), style = ShareTypography.header)
                MapToolButton("Закрыть просмотр карты", Glyph.Close) { c.preview = null }
            }
            Row(Modifier.padding(horizontal = 12.dp)) { MapLibraryEntryActions(map, c) }
            (failure ?: c.error)?.let {
                Text(it, color = WebPalette.Danger)
                ShareTextButton({
                    retry++
                    c.open(map)
                    scene?.retry()
                }) {
                    Text("Повторить")
                }
            }
            Box(Modifier.fillMaxWidth().weight(1f)) {
                if (!c.previewReady || loading) ShareSkeletonBlock(Modifier.fillMaxSize())
                else
                    MapSceneView(
                        map.document,
                        models,
                        cache,
                        emptySet(),
                        orbit = false,
                        tap = {},
                        drag = { _, _ -> },
                        cancel = {},
                        renderer = { scene = it },
                        status = { _, message -> if (message != null) failure = message },
                    )
                MapViewerTools(
                    scene,
                    map.document,
                    Modifier.align(Alignment.BottomStart).padding(12.dp),
                )
            }
        }
    }
}
