package ru.dndshare.client.ui.character

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch
import ru.dndshare.client.character.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun DndDeathSaves() {
    val context = LocalCharacterSheet.current
    val hp = context.sheet.values["hp"].objectValue()
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 64.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            for ((key, label) in listOf("ds_failure" to "Провалы", "ds_success" to "Успехи")) {
                val color = if (key == "ds_failure") WebPalette.Danger else WebPalette.Success
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Row {
                        for (index in
                            (if (key == "ds_failure") listOf(3, 2, 1) else listOf(1, 2, 3))) {
                            val filled = hp[key].number() >= index
                            val fill =
                                animateColorAsState(
                                    if (filled) color else WebPalette.Raised,
                                    tween(DesignTokens.Motion.Feedback),
                                    label = "Death save fill",
                                )
                            val border =
                                animateColorAsState(
                                    if (filled) color else WebPalette.BorderStrong,
                                    tween(DesignTokens.Motion.Feedback),
                                    label = "Death save border",
                                )
                            IconButton(
                                onClick = {
                                    scope.launch {
                                        busy = true
                                        try {
                                            error = context.deathSave(key, index)
                                        } finally {
                                            busy = false
                                        }
                                    }
                                },
                                enabled = context.canEdit && !busy && hp["current"].number() <= 0,
                                modifier =
                                    Modifier.size(48.dp).semantics {
                                        contentDescription = "$label: $index"
                                        stateDescription = if (filled) "Отмечено" else "Не отмечено"
                                    },
                            ) {
                                Canvas(Modifier.size(16.dp)) {
                                    drawCircle(fill.value)
                                    drawCircle(
                                        border.value,
                                        radius = size.minDimension / 2 - .5.dp.toPx(),
                                        style = Stroke(1.dp.toPx()),
                                    )
                                }
                            }
                        }
                    }
                    Text(
                        label.uppercase(),
                        color = color,
                        style =
                            ShareTypography.context.copy(
                                fontSize = 10.sp,
                                lineHeight = 14.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = .8.sp,
                            ),
                    )
                }
                if (key == "ds_failure")
                    AsyncImage(
                        "file:///android_asset/character-sheet/hp-pulse.svg",
                        null,
                        imageLoader = context.images,
                        colorFilter = ColorFilter.tint(WebPalette.Danger),
                        modifier = Modifier.size(30.dp),
                    )
            }
        }
        error?.let { Text(it, color = WebPalette.Danger, style = ShareTypography.context) }
    }
}
