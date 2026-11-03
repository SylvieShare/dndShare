package ru.dndshare.client.ui.maps

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp
import ru.dndshare.client.maps.rendering.MapRenderTelemetry
import ru.dndshare.client.ui.designsystem.*

internal data class MapPerformancePart(val id: String, val label: String, val colour: Color)

internal val mapCpuPerformanceParts =
    listOf(
        MapPerformancePart("models", "Модели", WebPalette.AccentSoft),
        MapPerformancePart("areas", "Преобразования и области", WebPalette.Success),
        MapPerformancePart("lighting", "Освещение", WebPalette.Warning),
        MapPerformancePart("effects", "Вода и огонь", WebPalette.Danger),
        MapPerformancePart("fog", "Туман", WebPalette.AccentSoft),
        MapPerformancePart("outlines", "Контуры", WebPalette.Success),
        MapPerformancePart("picking", "Выбор", WebPalette.Warning),
        MapPerformancePart("overlays", "Метки и подготовка", WebPalette.TextMuted),
        MapPerformancePart("draw", "Отправка в GPU", WebPalette.Info),
        MapPerformancePart("presentation", "Вывод кадра", WebPalette.Info),
        MapPerformancePart("previews", "Превью", WebPalette.Warning),
        MapPerformancePart("other", "Прочее", WebPalette.TextMuted),
    )

@Composable
internal fun MapPerformanceChart(data: MapRenderTelemetry, metric: String) {
    Canvas(
        Modifier.fillMaxWidth().height(150.dp).semantics {
            contentDescription = "История нагрузки за 30 секунд, шаг 500 мс"
        }
    ) {
        val samples = data.history
        if (samples.isEmpty()) return@Canvas
        val maximum =
            maxOf(
                16.7f,
                samples.maxOf { if (metric == "gpu") it.gpuMs ?: 0f else it.cpuMs ?: 0f },
            ) * 1.1f
        val column = size.width / 60
        drawLine(
            WebPalette.BorderStrong,
            Offset(0f, size.height * (1 - 16.7f / maximum)),
            Offset(size.width, size.height * (1 - 16.7f / maximum)),
        )
        samples.forEachIndexed { index, sample ->
            val values =
                if (metric == "gpu")
                    sample.gpuMs?.let { listOf(WebPalette.AccentSoft to it) }.orEmpty()
                else mapCpuPerformanceParts.map { it.colour to (sample.cpu?.get(it.id) ?: 0f) }
            var y = size.height
            for ((colour, ms) in values) if (ms > 0) {
                val height = ms / maximum * size.height
                drawRect(
                    colour,
                    Offset(index * column, y - height),
                    Size((column - 1.dp.toPx()).coerceAtLeast(1f), height),
                )
                y -= height
            }
        }
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text("30 с назад", style = ShareTypography.context, color = WebPalette.TextMuted)
        Text("Сейчас", style = ShareTypography.context, color = WebPalette.TextMuted)
    }
}
