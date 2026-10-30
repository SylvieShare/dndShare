package ru.dndshare.client.ui.character

import androidx.compose.animation.ExperimentalSharedTransitionApi
import androidx.compose.animation.animateBounds
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.*
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.*
import androidx.compose.ui.platform.*
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

internal val LocalWeaponScroll = staticCompositionLocalOf<ScrollState?> { null }

@OptIn(ExperimentalSharedTransitionApi::class)
@Composable
internal fun WeaponGrid(
    rows: List<JsonObject>,
    columns: Int,
    canDrag: Boolean,
    reorder: suspend (List<String>) -> String?,
    content: @Composable (JsonObject, Modifier, Boolean) -> Unit,
) {
    val ids = rows.map { it.text("uid") }
    var order by remember { mutableStateOf(ids) }
    var active by remember { mutableStateOf<String?>(null) }
    var pointer by remember { mutableStateOf(Offset.Zero) }
    var origin by remember { mutableStateOf(Offset.Zero) }
    var anchor by remember { mutableStateOf(Offset.Zero) }
    var pendingOrder by remember { mutableStateOf<List<String>?>(null) }
    var lastDropBounds by remember { mutableStateOf<Rect?>(null) }
    var before by remember { mutableStateOf(ids) }
    val rectangles = remember { mutableMapOf<String, Rect>() }
    val latest by rememberUpdatedState(rows)
    val latestReorder by rememberUpdatedState(reorder)
    val haptics = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    val scroll = LocalWeaponScroll.current
    val density = LocalDensity.current
    val window = LocalWindowInfo.current
    val inset = LocalChromePadding.current
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(ids, active, busy, pendingOrder) {
        if (active == null) {
            val pending = pendingOrder
            if (pending != null && ids.filter { it in pending } == pending.filter { it in ids })
                pendingOrder = null
            if (!busy && pendingOrder == null) order = ids
        }
    }
    fun nearest() {
        val held = active ?: return
        val local = pointer - origin
        // Block the occupied destination slot, not the item that moved out of it.
        // The same neighbour can be crossed again when returning to the original slot.
        if (lastDropBounds?.contains(local) == true) return
        val target =
            order.firstOrNull {
                it != held && rectangles[it]?.contains(local) == true
            } ?: return
        lastDropBounds = rectangles[target]
        val from = order.indexOf(held)
        val to = order.indexOf(target)
        if (from >= 0 && to >= 0) order = order.toMutableList().apply { add(to, removeAt(from)) }
    }
    fun finish(cancelled: Boolean) {
        val changed = active != null && before != order
        active = null
        lastDropBounds = null
        if (cancelled) {
            order = before
            return
        }
        if (changed) {
            val submitted = order.toList()
            pendingOrder = submitted
            busy = true
            scope.launch {
                try {
                    error = latestReorder(submitted)
                    if (error != null) {
                        pendingOrder = null
                        order = latest.map { it.text("uid") }
                    }
                } finally {
                    busy = false
                }
            }
        }
    }
    LaunchedEffect(active, scroll) {
        if (active == null || scroll == null) return@LaunchedEffect
        var then = withFrameNanos { it }
        while (isActive) {
            val now = withFrameNanos { it }
            val dt = ((now - then) / 1_000_000_000f).coerceIn(0f, .05f)
            then = now
            val edge = with(density) { 64.dp.toPx() }
            val top = with(density) { inset.calculateTopPadding().toPx() }
            val bottom =
                window.containerSize.height -
                    with(density) { inset.calculateBottomPadding().toPx() }
            val factor =
                when {
                    pointer.y < top + edge -> -(top + edge - pointer.y) / edge
                    pointer.y > bottom - edge -> (pointer.y - bottom + edge) / edge
                    else -> 0f
                }.coerceIn(-1f, 1f)
            if (factor != 0f) {
                scroll.scrollBy(factor * with(density) { 700.dp.toPx() } * dt)
                nearest()
            }
        }
    }
    val gridModifier =
        Modifier.fillMaxWidth()
            .onGloballyPositioned { origin = it.positionInWindow() }
            .shareLongPressDrag(
                canDrag && !busy && ids.all(String::isNotBlank) && ids.distinct().size == ids.size,
                onStart = { local ->
                    val point = origin + local
                    val id = order.firstOrNull {
                        rectangles[it]?.translate(origin)?.contains(point) == true
                    }
                    if (id == null) false
                    else {
                        active = id
                        before = order
                        lastDropBounds = null
                        pointer = point
                        anchor = point - (rectangles[id]?.translate(origin)?.center ?: point)
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        true
                    }
                },
                onMove = { local, _ ->
                    pointer = origin + local
                    nearest()
                },
                onEnd = ::finish,
            )

    val byId = rows.associateBy { it.text("uid") }
    val shown = order.filter { it in byId }
    LookaheadScope {
        val lookahead = this
        Layout(
            modifier = gridModifier,
            content = {
                shown.forEach { uid ->
                    key(uid) {
                        val dragging = active == uid
                        Box(
                            Modifier.fillMaxWidth()
                                .zIndex(if (dragging) 1f else 0f)
                                .then(if (dragging) Modifier else Modifier.animateBounds(lookahead))
                        ) {
                            val visual =
                                Modifier.fillMaxWidth()
                                    .graphicsLayer {
                                        scroll?.value
                                        val rect = rectangles[uid]
                                        val delta =
                                            if (dragging && rect != null)
                                                pointer - anchor - (rect.center + origin)
                                            else Offset.Zero
                                        translationX = delta.x
                                        translationY = delta.y
                                        scaleX = if (dragging) 1.025f else 1f
                                        scaleY = scaleX
                                        shadowElevation = if (dragging) 12.dp.toPx() else 0f
                                    }
                                    .semantics {
                                        if (canDrag)
                                            customActions = buildList {
                                                val index = order.indexOf(uid)
                                                fun move(delta: Int): Boolean {
                                                    val next =
                                                        order.toMutableList().apply {
                                                            add(index + delta, removeAt(index))
                                                        }
                                                    before = order
                                                    order = next
                                                    active = uid
                                                    finish(false)
                                                    return true
                                                }
                                                if (index > 0)
                                                    add(
                                                        CustomAccessibilityAction(
                                                            "Переместить выше"
                                                        ) {
                                                            move(-1)
                                                        }
                                                    )
                                                if (index < order.lastIndex)
                                                    add(
                                                        CustomAccessibilityAction(
                                                            "Переместить ниже"
                                                        ) {
                                                            move(1)
                                                        }
                                                    )
                                            }
                                    }
                            content(byId.getValue(uid), visual, dragging)
                        }
                    }
                }
            },
        ) { measurables, constraints ->
            val gap = 12.dp.roundToPx()
            val vertical = 10.dp.roundToPx()
            val width = ((constraints.maxWidth - gap * (columns - 1)) / columns).coerceAtLeast(0)
            val places = measurables.map {
                it.measure(constraints.copy(minWidth = width, maxWidth = width, minHeight = 0))
            }
            val heights = places.chunked(columns).map { row -> row.maxOfOrNull { it.height } ?: 0 }
            val total = heights.sum() + vertical * (heights.size - 1).coerceAtLeast(0)
            layout(constraints.maxWidth, total) {
                var y = 0
                places.chunked(columns).forEachIndexed { row, cells ->
                    cells.forEachIndexed { col, cell ->
                        val local = Offset((col * (width + gap)).toFloat(), y.toFloat())
                        rectangles[shown[row * columns + col]] =
                            Rect(local, Size(cell.width.toFloat(), cell.height.toFloat()))
                        cell.placeRelative(col * (width + gap), y)
                    }
                    y += heights[row] + vertical
                }
            }
        }
    }
    error?.let {
        androidx.compose.material3.Text(
            it,
            color = WebPalette.Danger,
            style = ShareTypography.context,
        )
    }
}
