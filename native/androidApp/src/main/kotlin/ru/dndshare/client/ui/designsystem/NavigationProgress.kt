package ru.dndshare.client.ui.designsystem

import kotlin.math.abs

internal data class NavigationItemFrame(val x: Float, val width: Float, val weight: Float)

internal data class NavigationFrame(
    val items: List<NavigationItemFrame>,
    val indicatorX: Float,
    val indicatorWidth: Float,
)

/** Same interpolation as the web strip; an integer page change at .5 is not a new selection. */
internal fun navigationFrame(
    count: Int,
    position: Float,
    baseWidth: Float,
    selectedExtra: Float,
    gap: Float,
): NavigationFrame {
    if (count == 0) return NavigationFrame(emptyList(), 0f, 0f)
    val page = position.coerceIn(0f, (count - 1).toFloat())
    var x = 0f
    var indicatorX = 0f
    var indicatorWidth = 0f
    val items = List(count) { index ->
        val weight = (1f - abs(index - page)).coerceIn(0f, 1f)
        val width = baseWidth + selectedExtra * weight
        NavigationItemFrame(x, width, weight).also {
            indicatorX += x * weight
            indicatorWidth += width * weight
            x += width + gap
        }
    }
    return NavigationFrame(items, indicatorX, indicatorWidth)
}
