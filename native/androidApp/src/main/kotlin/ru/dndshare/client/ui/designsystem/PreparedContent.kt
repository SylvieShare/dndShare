package ru.dndshare.client.ui.designsystem

import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.layout.SubcomposeLayoutState
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.constrainHeight
import androidx.compose.ui.unit.constrainWidth
import kotlin.coroutines.coroutineContext
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.isActive

/** One shared frame budget, including when every page of a sheet is retained. */
@Stable
class SharePreparationQueue internal constructor() {
    internal val pending = linkedMapOf<Any, (Long) -> Boolean>()
    internal val wake = Channel<Unit>(Channel.CONFLATED)

    internal fun add(key: Any, work: (Long) -> Boolean) {
        pending[key] = work
        wake.trySend(Unit)
    }

    internal fun remove(key: Any) {
        pending.remove(key)
    }
}

@Composable
fun rememberSharePreparationQueue(
    priority: () -> Any?,
    busy: () -> Boolean,
): SharePreparationQueue {
    val queue = remember { SharePreparationQueue() }
    val currentPriority by rememberUpdatedState(priority)
    val currentBusy by rememberUpdatedState(busy)
    LaunchedEffect(queue) {
        while (coroutineContext.isActive) {
            if (queue.pending.isEmpty()) queue.wake.receive()
            withFrameNanos {}
            if (currentBusy()) continue
            val key =
                currentPriority()?.takeIf { it in queue.pending }
                    ?: queue.pending.keys.firstOrNull()
                    ?: continue
            // Composition can yield at compiler-generated pause points. Never spend
            // eight independent page budgets in the same display frame.
            if (queue.pending[key]?.invoke(System.nanoTime() + 2_000_000L) == true)
                queue.remove(key)
        }
    }
    return queue
}

/** Paints its placeholder first, then incrementally prepares one persistent native subtree. */
@Composable
fun SharePreparedContent(
    key: Any,
    queue: SharePreparationQueue,
    modifier: Modifier = Modifier,
    placeholder: @Composable () -> Unit,
    content: @Composable () -> Unit,
) {
    val layout = remember(key) { SubcomposeLayoutState() }
    val latestContent = rememberUpdatedState(content)
    val render = remember(key) { @Composable { latestContent.value() } }
    var ready by remember(key) { mutableStateOf(false) }
    val preparation = remember(key, layout) { PreparedSubtree(layout, render) }
    DisposableEffect(preparation, queue) {
        queue.add(key) { deadline ->
            preparation.step(deadline).also { complete -> if (complete) ready = true }
        }
        onDispose {
            queue.remove(key)
            preparation.dispose()
        }
    }
    SubcomposeLayout(layout, modifier) { constraints ->
        preparation.constraints = constraints
        val children =
            subcompose(if (ready) Content else Placeholder, if (ready) render else placeholder)
                .map { it.measure(constraints) }
        val width = constraints.constrainWidth(children.maxOfOrNull { it.width } ?: 0)
        val height = constraints.constrainHeight(children.maxOfOrNull { it.height } ?: 0)
        layout(width, height) { children.forEach { it.placeRelative(0, 0) } }
    }
}

private object Content

private object Placeholder

private class PreparedSubtree(
    val layout: SubcomposeLayoutState,
    val render: @Composable () -> Unit,
) {
    var constraints: Constraints? = null
    private var paused: SubcomposeLayoutState.PausedPrecomposition? = null
    private var composed: SubcomposeLayoutState.PrecomposedSlotHandle? = null
    private var measured = 0

    fun step(deadline: Long): Boolean {
        val bounds = constraints ?: return false
        val handle = composed
        if (handle == null) {
            val work =
                paused ?: layout.createPausedPrecomposition(Content, render).also { paused = it }
            if (!work.isComplete) work.resume { System.nanoTime() >= deadline }
            if (work.isComplete) {
                composed = work.apply()
                paused = null
            }
            return false
        }
        // Measure on a later frame, separately from composition/applyChanges.
        while (measured < handle.placeablesCount) {
            handle.premeasure(measured++, bounds)
            if (System.nanoTime() >= deadline) return false
        }
        return true
    }

    fun dispose() {
        paused?.cancel()
        composed?.dispose()
    }
}
