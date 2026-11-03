package ru.dndshare.client.ui.maps

import android.os.SystemClock
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import ru.dndshare.client.maps.rendering.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapPerformancePanel(workspace: MapEditorWorkspace) {
    val snapshot by
        produceState(MapRenderTelemetry() to 0L, workspace.scene) {
            while (true) {
                value =
                    (workspace.scene?.telemetry ?: MapRenderTelemetry()) to
                        SystemClock.uptimeMillis()
                delay(250)
            }
        }
    val data = snapshot.first
    MapInspectorSection("Отрисовка") {
        ShareToggle("Всегда использовать LOD-модели", workspace.ui.forceLod) { force ->
            workspace.controller.ui { it.copy(forceLod = force) }
            workspace.scene?.options(MapSceneOptions(forceLod = force))
        }
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
    MapInspectorSection("Производительность") {
        val last = data.history.lastOrNull()
        Text(
            if (snapshot.second - data.time > 700) "В покое · кадры не рисуются"
            else "Кадров: ${data.frames}",
            style = ShareTypography.context,
        )
        Text(
            "Подготовка CPU: ${last?.let {"%.2f мс".format(it.cpuMs)} ?: "—"}",
            style = ShareTypography.context,
        )
        Text(
            "Отрисовка GPU: ${last?.gpuMs?.let {"%.2f мс".format(it)} ?: "—"}",
            style = ShareTypography.context,
        )
        Canvas(Modifier.fillMaxWidth().height(120.dp)) {
            val samples = data.history
            if (samples.size < 2) return@Canvas
            val maximum = maxOf(16.67f, samples.maxOf { maxOf(it.cpuMs, it.gpuMs ?: 0f) })
            drawLine(
                WebPalette.BorderStrong,
                Offset(0f, size.height * (1 - 16.67f / maximum)),
                Offset(size.width, size.height * (1 - 16.67f / maximum)),
            )
            fun series(
                colour: androidx.compose.ui.graphics.Color,
                value: (MapFrameTiming) -> Float?,
            ) {
                val path = Path()
                var connected = false
                samples.forEachIndexed { index, sample ->
                    val ms = value(sample)
                    if (ms == null) connected = false
                    else {
                        val x = index * size.width / (samples.size - 1)
                        val y = size.height * (1 - ms / maximum)
                        if (connected) path.lineTo(x, y)
                        else {
                            path.moveTo(x, y)
                            connected = true
                        }
                    }
                }
                drawPath(path, colour, style = Stroke(2.dp.toPx()))
            }
            series(WebPalette.AccentSoft) { it.cpuMs }
            series(WebPalette.Success) { it.gpuMs }
        }
    }
}
