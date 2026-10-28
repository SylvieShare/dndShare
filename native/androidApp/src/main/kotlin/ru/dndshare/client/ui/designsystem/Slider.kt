package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Slider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.unit.dp

/** Keep native drag/keyboard/accessibility behavior with the web track and thumb. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShareSlider(
    value: Float,
    onValueChange: (Float) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    valueRange: ClosedFloatingPointRange<Float> = 0f..1f,
    steps: Int = 0,
    onValueChangeFinished: (() -> Unit)? = null,
) {
    Slider(
        value,
        onValueChange,
        modifier.heightIn(min = 48.dp),
        enabled = enabled,
        valueRange = valueRange,
        steps = steps,
        onValueChangeFinished = onValueChangeFinished,
        thumb = {
            Box(
                Modifier.size(DesignTokens.Layout.SliderThumb)
                    .background(WebPalette.Accent, CircleShape)
            )
        },
        track = { state ->
            Canvas(Modifier.fillMaxWidth().height(DesignTokens.Layout.SliderTrack)) {
                val fraction =
                    if (valueRange.endInclusive == valueRange.start) 0f
                    else
                        ((state.value - valueRange.start) /
                                (valueRange.endInclusive - valueRange.start))
                            .coerceIn(0f, 1f)
                drawLine(
                    WebPalette.BorderStrong,
                    Offset(0f, size.height / 2),
                    Offset(size.width, size.height / 2),
                    size.height,
                    StrokeCap.Round,
                )
                drawLine(
                    WebPalette.Accent,
                    Offset(0f, size.height / 2),
                    Offset(size.width * fraction, size.height / 2),
                    size.height,
                    StrokeCap.Round,
                )
            }
        },
    )
}
