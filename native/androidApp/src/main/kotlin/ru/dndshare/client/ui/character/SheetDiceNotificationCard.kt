package ru.dndshare.client.ui.character

import android.os.SystemClock
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.*
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusEvent
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.*
import kotlinx.coroutines.delay
import kotlinx.serialization.json.JsonPrimitive
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SheetDiceNotificationCard(
    notice: SheetDiceNotice,
    busy: Boolean,
    locked: Boolean,
    close: () -> Unit,
    repeat: () -> Unit,
    mode: (String) -> Unit,
    reroll: (String) -> Unit,
) {
    var expanded by rememberSaveable(notice.id) { mutableStateOf(false) }
    var selectingMode by remember { mutableStateOf(false) }
    var drag by remember { mutableFloatStateOf(0f) }
    val threshold = with(LocalDensity.current) { 100.dp.toPx() }
    val interaction = remember { MutableInteractionSource() }
    val hovered by interaction.collectIsHoveredAsState()
    var focused by remember { mutableStateOf(false) }
    var pressed by remember { mutableStateOf(false) }
    var dragging by remember { mutableStateOf(false) }
    val offset by
        animateFloatAsState(
            drag,
            if (dragging) snap() else tween(180),
            label = "Notification swipe",
        )
    val paused = expanded || hovered || focused || pressed || selectingMode
    var remaining by
        remember(notice.id, notice.completedAt) {
            mutableLongStateOf(
                if (notice.completedAt > 0)
                    (6_000 - (System.currentTimeMillis() - notice.completedAt)).coerceIn(0, 6_000)
                else 6_000
            )
        }
    LaunchedEffect(notice.id, notice.completedAt, notice.error, busy, paused) {
        if (!busy && !paused && notice.error == null && notice.completedAt > 0) {
            val start = SystemClock.elapsedRealtime()
            try {
                delay(remaining)
                close()
            } finally {
                remaining = (remaining - (SystemClock.elapsedRealtime() - start)).coerceAtLeast(0)
            }
        }
    }
    Surface(
        Modifier.fillMaxWidth()
            .graphicsLayer {
                translationX = offset
                alpha = (1 - kotlin.math.abs(offset) / (threshold * 3)).coerceIn(.3f, 1f)
            }
            .hoverable(interaction)
            .onFocusEvent { focused = it.hasFocus }
            .focusGroup()
            .pointerInput(notice.id) {
                awaitEachGesture {
                    awaitFirstDown(requireUnconsumed = false)
                    pressed = true
                    try {
                        do {
                            val event = awaitPointerEvent()
                        } while (event.changes.any { it.pressed })
                    } finally {
                        pressed = false
                    }
                }
            }
            .pointerInput(notice.id) {
                detectHorizontalDragGestures(
                    onDragStart = { dragging = true },
                    onDragEnd = {
                        dragging = false
                        if (kotlin.math.abs(drag) > threshold) close() else drag = 0f
                    },
                    onDragCancel = {
                        dragging = false
                        drag = 0f
                    },
                ) { change, amount ->
                    change.consume()
                    drag += amount
                }
            }
            .animateContentSize()
            .semantics { liveRegion = LiveRegionMode.Polite },
        shape = RoundedCornerShape(12.dp),
        color = WebPalette.Surface,
        shadowElevation = 8.dp,
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    notice.request.title,
                    Modifier.weight(1f),
                    style =
                        ShareTypography.context.copy(
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                        ),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Box(
                    Modifier.size(28.dp).clickable(role = Role.Button, onClick = close).semantics {
                        contentDescription = "Закрыть уведомление"
                    },
                    contentAlignment = Alignment.Center,
                ) {
                    AppGlyph(Glyph.Close, Modifier.size(16.dp))
                }
            }
            val result = notice.result
            if (result == null) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    ShareDie(20, "…")
                    Text(
                        if (busy) "Бросаем…" else "Результат не получен",
                        style = ShareTypography.context,
                        color = WebPalette.TextMuted,
                    )
                    if (busy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                }
            } else
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    FlowRow(
                        Modifier.weight(1f),
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        var count = 0
                        result.parts.forEach { part ->
                            val fallback =
                                if (notice.request.kind == "heal") {
                                    if (
                                        notice.request.eventData["temporaryHp"] ==
                                            JsonPrimitive(true)
                                    )
                                        WebPalette.Info
                                    else WebPalette.Success
                                } else WebPalette.Accent
                            val tint =
                                remember(part.text("color"), fallback) {
                                    runCatching {
                                            androidx.compose.ui.graphics.Color(
                                                android.graphics.Color.parseColor(
                                                    part.text("color")
                                                )
                                            )
                                        }
                                        .getOrDefault(fallback)
                                }
                            if (part.text("kind") == "dice") {
                                val dropped =
                                    part["dropped"].arrayValue().map { it.number() }.toSet()
                                part["rolls"].arrayValue().forEachIndexed { index, die ->
                                    if (count++ < 12)
                                        ShareDie(
                                            part["sides"].number(20),
                                            die.number().toString(),
                                            color = tint,
                                            modifier =
                                                Modifier.graphicsLayer {
                                                    alpha = if (index in dropped) .35f else 1f
                                                },
                                        )
                                }
                            }
                        }
                        if (count > 12)
                            Text(
                                "+" + (count - 12),
                                style = ShareTypography.context,
                                color = WebPalette.TextMuted,
                            )
                    }
                    Text(
                        result.total.toString(),
                        style =
                            ShareTypography.group.copy(
                                fontSize = 32.sp,
                                lineHeight = 36.sp,
                                fontWeight = FontWeight.ExtraBold,
                            ),
                        color =
                            when {
                                result.selected != null &&
                                    result.selected >= notice.request.criticalThreshold ->
                                    WebPalette.Success
                                result.selected == 1 && result.adjustments.isEmpty() ->
                                    WebPalette.Danger
                                else -> WebPalette.Text
                            },
                    )
                }
            if (result != null && result.byType.count { it.text("label").isNotBlank() } > 1)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    result.byType.forEach { type ->
                        val tint =
                            remember(type.text("color")) {
                                runCatching {
                                        androidx.compose.ui.graphics.Color(
                                            android.graphics.Color.parseColor(type.text("color"))
                                        )
                                    }
                                    .getOrDefault(WebPalette.TextSecondary)
                            }
                        Text(
                            type.text("label") + ": " + type["value"].number(),
                            style = ShareTypography.context,
                            color = tint,
                        )
                    }
                }
            if (result != null) {
                Text(
                    result.expression,
                    style = ShareTypography.context,
                    color = WebPalette.TextMuted,
                )
                if (expanded) SheetRollResultView(result, notice.request.criticalThreshold)
            }
            notice.error?.let {
                Text(it, style = ShareTypography.context, color = WebPalette.Danger)
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                if (notice.request.repeatable)
                    ShareTextButton(repeat, enabled = !locked) {
                        Text(if (notice.error == null) "Ещё раз" else "Повторить")
                    }
                if (result != null)
                    ShareTextButton({ expanded = !expanded }) {
                        Text(if (expanded) "Свернуть" else "Подробности")
                    }
                if (notice.request.formula == null && notice.request.repeatable)
                    Box {
                        ShareTextButton({ selectingMode = true }, enabled = !locked) {
                            Text(
                                rollModeOptions.firstOrNull { it.first == notice.mode }?.second
                                    ?: "Авто"
                            )
                        }
                        ShareDropdownMenu(selectingMode, { selectingMode = false }) {
                            rollModeOptions.forEach { (key, title) ->
                                ShareDropdownMenuItem(
                                    text = { Text(title) },
                                    onClick = {
                                        selectingMode = false
                                        mode(key)
                                    },
                                )
                            }
                        }
                    }
            }
            notice.actions.forEach { action ->
                ShareTextButton({ reroll(action.key) }, enabled = !locked) { Text(action.label) }
            }
        }
    }
}
