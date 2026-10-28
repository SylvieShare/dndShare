package ru.dndshare.client.ui.designsystem

import androidx.compose.animation.core.spring
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import kotlinx.coroutines.isActive

/** Bounded native list: drag handle, edge scrolling and equivalent TalkBack/keyboard actions. */
@Composable
fun ShareReorderList(
    rows: List<Pair<String, String>>,
    enabled: Boolean = true,
    move: (String, String) -> Unit,
) {
    val state = rememberLazyListState()
    val currentRows by rememberUpdatedState(rows)
    val currentMove by rememberUpdatedState(move)
    var dragging by remember { mutableStateOf<String?>(null) }
    var lastTarget by remember { mutableStateOf<String?>(null) }
    var center by remember { mutableFloatStateOf(0f) }
    val haptics = LocalHapticFeedback.current
    fun moveAdjacent(key: String, step: Int) {
        val index = currentRows.indexOfFirst { it.first == key }
        val target = currentRows.getOrNull(index + step) ?: return
        if (index >= 0) currentMove(key, target.first)
    }
    fun moveToNearest() {
        val key = dragging ?: return
        val target =
            state.layoutInfo.visibleItemsInfo.minByOrNull {
                kotlin.math.abs(it.offset + it.size / 2f - center)
            } ?: return
        if (target.key == key) {
            lastTarget = null
            return
        }
        if (lastTarget == target.key.toString()) return
        lastTarget = target.key.toString()

        // Keep the viewport at its index while its first key is being moved.
        state.requestScrollToItem(state.firstVisibleItemIndex, state.firstVisibleItemScrollOffset)
        currentMove(key, target.key.toString())
    }
    val density = LocalDensity.current
    val edge = with(density) { 48.dp.toPx() }
    val maximumSpeed = with(density) { 600.dp.toPx() }
    LaunchedEffect(dragging, edge) {
        if (dragging == null) return@LaunchedEffect
        var previousFrame = withFrameNanos { it }
        while (isActive) {
            val frame = withFrameNanos { it }
            val seconds = ((frame - previousFrame) / 1_000_000_000f).coerceIn(0f, .05f)
            previousFrame = frame
            val layout = state.layoutInfo
            val proximity =
                when {
                    center < layout.viewportStartOffset + edge ->
                        -(layout.viewportStartOffset + edge - center) / edge
                    center > layout.viewportEndOffset - edge ->
                        (center - layout.viewportEndOffset + edge) / edge
                    else -> 0f
                }.coerceIn(-1f, 1f)
            if (
                proximity < 0 && state.canScrollBackward || proximity > 0 && state.canScrollForward
            ) {
                if (state.scrollBy(proximity * maximumSpeed * seconds) != 0f) moveToNearest()
            }
        }
    }
    LazyColumn(
        Modifier.fillMaxWidth()
            .heightIn(max = 480.dp)
            .semantics { contentDescription = "Порядок записей" }
            .shareLongPressDrag(
                enabled,
                onStart = { position ->
                    val origin =
                        state.layoutInfo.visibleItemsInfo.firstOrNull {
                            position.y >= it.offset && position.y < it.offset + it.size
                        }
                    if (origin == null || position.x >= state.layoutInfo.viewportSize.width - edge)
                        false
                    else {
                        center = origin.offset + origin.size / 2f
                        lastTarget = null
                        dragging = origin.key.toString()
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        true
                    }
                },
                onMove = { _, delta ->
                    center += delta.y
                    moveToNearest()
                },
                onEnd = { dragging = null },
            ),
        state = state,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        itemsIndexed(rows, key = { _, row -> row.first }) { index, row ->
            val active = dragging == row.first
            Row(
                Modifier.fillMaxWidth()
                    .animateItem(placementSpec = if (active) null else spring())
                    .zIndex(if (active) 1f else 0f)
                    .graphicsLayer {
                        val info =
                            state.layoutInfo.visibleItemsInfo.firstOrNull { it.key == row.first }
                        translationY =
                            if (active && info != null) center - (info.offset + info.size / 2f)
                            else 0f
                    }
                    .semantics {
                        customActions = buildList {
                            if (enabled && index > 0)
                                add(
                                    CustomAccessibilityAction("Переместить выше") {
                                        moveAdjacent(row.first, -1)
                                        true
                                    }
                                )
                            if (enabled && index < rows.lastIndex)
                                add(
                                    CustomAccessibilityAction("Переместить ниже") {
                                        moveAdjacent(row.first, 1)
                                        true
                                    }
                                )
                        }
                    },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(row.second, Modifier.weight(1f).padding(8.dp), style = ShareTypography.group)
                Box(
                    contentAlignment = Alignment.Center,
                    modifier =
                        Modifier.size(48.dp).semantics {
                            contentDescription = "Перетащить: ${row.second}"
                            stateDescription =
                                if (active) "Перетаскивается · позиция ${index+1} из ${rows.size}"
                                else "Позиция ${index+1} из ${rows.size}"
                        },
                ) {
                    Text("☰", color = WebPalette.TextMuted)
                }
                ShareActionMenu(
                    "Порядок: ${row.second}",
                    listOf(
                        ShareMenuAction(
                            "Выше",
                            { moveAdjacent(row.first, -1) },
                            enabled && index > 0,
                        ),
                        ShareMenuAction(
                            "Ниже",
                            { moveAdjacent(row.first, 1) },
                            enabled && index < rows.lastIndex,
                        ),
                    ),
                )
            }
        }
    }
}
