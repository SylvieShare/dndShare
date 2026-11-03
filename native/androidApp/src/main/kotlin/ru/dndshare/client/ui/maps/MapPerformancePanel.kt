package ru.dndshare.client.ui.maps

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.delay
import ru.dndshare.client.maps.rendering.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapPerformancePanel(workspace: MapEditorWorkspace) {
    val context = LocalContext.current.applicationContext
    val settings = remember(context) { MapRenderSettings.get(context) }
    val forceLod by settings.forceLod.collectAsState()
    var enabled by remember { mutableStateOf(true) }
    var metric by remember { mutableStateOf("gpu") }
    val stage by LocalLifecycleOwner.current.lifecycle.currentStateFlow.collectAsState()
    val foreground =
        stage.isAtLeast(Lifecycle.State.STARTED) &&
            !workspace.referenceOpen &&
            workspace.sidebarOpen
    val scene = workspace.scene
    DisposableEffect(scene, enabled, foreground) {
        scene?.measurePerformance(enabled && foreground)
        onDispose { scene?.measurePerformance(false) }
    }
    val data by
        produceState(MapRenderTelemetry(), scene, foreground, enabled) {
            while (foreground) {
                val renderer = scene
                if (renderer != null) {
                    val next = CompletableDeferred<MapRenderTelemetry>()
                    renderer.performance { next.complete(it) }
                    value = next.await()
                }
                delay(500)
            }
        }
    MapInspectorSection("Отрисовка") {
        ShareToggle("Всегда использовать LOD-модели", forceLod, change = settings::setForceLod)
    }
    MapInspectorSection("Ресурсы моделей") {
        Text("На сцене: ${data.instances}", style = ShareTypography.context)
        Text("Локальный свет: ${data.lights}/8", style = ShareTypography.context)
        Text("Уникальных моделей: ${data.models}", style = ShareTypography.context)
        Text(
            "Файлы моделей: ${"%.1f".format(data.fileBytes/1048576.0)} МБ",
            style = ShareTypography.context,
        )
        Text(
            "Данные файлов не включают память GPU.",
            style = ShareTypography.context,
            color = WebPalette.TextMuted,
        )
    }
    MapInspectorSection(
        "Нагрузка",
        actions = {
            ShareSwitch(
                enabled,
                { enabled = it },
                Modifier.semantics { contentDescription = "Измерять нагрузку" },
            )
        },
    ) {
        ShareTile(
            framed = false,
            containerColor = WebPalette.Surface,
            contentPadding = PaddingValues(12.dp),
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f)) {
                    Text("Кадр CPU", style = ShareTypography.context, color = WebPalette.TextMuted)
                    Text(
                        mapPerformanceMs(data.cpu.values.takeIf { it.isNotEmpty() }?.sum()),
                        style = ShareTypography.header,
                    )
                    Spacer(Modifier.height(12.dp))
                    Text(
                        "Обновлений / с",
                        style = ShareTypography.context,
                        color = WebPalette.TextMuted,
                    )
                    Text(
                        if (enabled && !data.idle) "%.0f".format(data.fps) else "0",
                        style = ShareTypography.header,
                    )
                }
                Column(Modifier.weight(1f)) {
                    Text("Кадр GPU", style = ShareTypography.context, color = WebPalette.TextMuted)
                    Text(mapPerformanceMs(data.gpuMs), style = ShareTypography.header)
                    Spacer(Modifier.height(12.dp))
                    Text("Режим", style = ShareTypography.context, color = WebPalette.TextMuted)
                    Text(
                        if (!enabled) "Пауза" else if (data.idle) "Покой" else "Обновляется",
                        style = ShareTypography.context,
                    )
                }
            }
        }
        ShareSelect(
            "Показатель графика нагрузки",
            metric,
            listOf("cpu" to "CPU · подготовка кадра", "gpu" to "GPU · кадр целиком"),
        ) {
            metric = it
        }
        MapPerformanceChart(data, metric)
        if (metric == "cpu")
            for (part in mapCpuPerformanceParts) {
                val ms = data.cpu[part.id] ?: continue
                if (ms > 0)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(part.label, style = ShareTypography.context, color = part.colour)
                        Text(mapPerformanceMs(ms), style = ShareTypography.context)
                    }
            }
        else
            Text(
                "GPU: кадр целиком, включая тени, туман и контуры.",
                style = ShareTypography.context,
                color = WebPalette.TextMuted,
            )
        if (metric == "gpu" && data.gpuMs == null)
            Text(
                "GPU-замер пока недоступен. CPU измеряется независимо.",
                style = ShareTypography.context,
                color = WebPalette.TextMuted,
            )
        Text("Изменение сцены: ${mapPerformanceMs(data.updateMs)}", style = ShareTypography.context)
    }
}

internal fun mapPerformanceMs(value: Float?) = value?.let { "%.2f мс".format(it) } ?: "—"
