package ru.dndshare.client.ui.designsystem

import android.graphics.Color as AndroidColor
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import java.util.Locale

/** Shared custom color control; callers own validation and change grouping. */
@Composable
fun ShareColorInput(
    value: String,
    change: (String) -> Unit,
    label: String = "Цвет",
    presets: List<String> =
        listOf("#8b5cf6", "#4f9cf9", "#22c55e", "#f59e0b", "#ef4444", "#ec4899"),
    finish: () -> Unit = {},
) {
    var open by remember { mutableStateOf(false) }
    fun hsv(hex: String) =
        FloatArray(3).also {
            AndroidColor.colorToHSV(
                runCatching { AndroidColor.parseColor(hex) }.getOrDefault(AndroidColor.WHITE),
                it,
            )
        }
    var channels by remember { mutableStateOf(hsv(value)) }
    val parsed = runCatching {
        Color(AndroidColor.parseColor(value))
    }
        .getOrDefault(WebPalette.Accent)
    ShareOutlinedButton(
        {
            channels = hsv(value)
            open = true
        },
        modifier = Modifier.fillMaxWidth(),
    ) {
        Surface(Modifier.size(24.dp), color = parsed, shape = MaterialTheme.shapes.small) {}
        Text(label, Modifier.weight(1f))
        Text(value, color = WebPalette.TextMuted, style = ShareTypography.context)
    }
    if (open)
        ShareFormDialog(
            label,
            {
                finish()
                open = false
            },
        ) {
            fun update(h: Float = channels[0], s: Float = channels[1], v: Float = channels[2]) {
                channels = floatArrayOf(h, s, v)
                change(
                    String.format(
                        Locale.ROOT,
                        "#%06x",
                        AndroidColor.HSVToColor(channels) and 0xffffff,
                    )
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                presets.forEach { hex ->
                    Surface(
                        {
                            channels = hsv(hex)
                            change(hex)
                            finish()
                        },
                        Modifier.size(36.dp),
                        color = Color(AndroidColor.parseColor(hex)),
                        shape = MaterialTheme.shapes.small,
                    ) {}
                }
            }
            Canvas(
                Modifier.fillMaxWidth().height(180.dp).pointerInput(channels[0]) {
                    fun pick(point: Offset) =
                        update(
                            s = (point.x / size.width).coerceIn(0f, 1f),
                            v = 1 - (point.y / size.height).coerceIn(0f, 1f),
                        )
                    detectDragGestures(
                        onDragStart = ::pick,
                        onDragEnd = finish,
                        onDragCancel = finish,
                        onDrag = { event, _ ->
                            event.consume()
                            pick(event.position)
                        },
                    )
                }
            ) {
                val hue = Color(AndroidColor.HSVToColor(floatArrayOf(channels[0], 1f, 1f)))
                drawRect(Brush.horizontalGradient(listOf(Color.White, hue)))
                drawRect(Brush.verticalGradient(listOf(Color.Transparent, Color.Black)))
                drawCircle(
                    Color.White,
                    6.dp.toPx(),
                    Offset(channels[1] * size.width, (1 - channels[2]) * size.height),
                    style = Stroke(2.dp.toPx()),
                )
            }
            Text("Оттенок", style = ShareTypography.context)
            ShareSlider(
                channels[0],
                { update(h = it) },
                valueRange = 0f..360f,
                onValueChangeFinished = finish,
            )
            Text("Насыщенность", style = ShareTypography.context)
            ShareSlider(channels[1], { update(s = it) }, onValueChangeFinished = finish)
            Text("Яркость", style = ShareTypography.context)
            ShareSlider(channels[2], { update(v = it) }, onValueChangeFinished = finish)
            ShareTextInput(
                value,
                { hex ->
                    if (hex.matches(Regex("#[0-9a-fA-F]{6}"))) {
                        channels = hsv(hex)
                        change(hex)
                        finish()
                    }
                },
                "HEX",
            )
        }
}
