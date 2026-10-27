package ru.dndshare.client.ui.designsystem

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.constrainHeight
import kotlin.math.abs

/** Contiguous groups preserve reading order while minimizing the column height range. */
fun balancedColumnBreaks(heights: List<Int>, columns: Int, gap: Int): List<IntRange> {
    if (heights.isEmpty()) return emptyList()
    val count = columns.coerceIn(1, heights.size)
    var best = listOf(heights.indices)
    var bestSpread = Int.MAX_VALUE
    fun visit(start: Int, left: Int, groups: List<IntRange>) {
        if (left == 1) {
            val candidate = groups + listOf(start..heights.lastIndex)
            val sums = candidate.map { range -> range.sumOf(heights::get) + gap * (range.count() - 1) }
            val spread = abs(sums.max() - sums.min())
            if (spread < bestSpread) { bestSpread = spread; best = candidate }
            return
        }
        for (end in start..(heights.size - left)) visit(end + 1, left - 1, groups + listOf(start..end))
    }
    visit(0, count, emptyList())
    return best
}

@Composable
fun ShareBalancedColumns(modifier: Modifier = Modifier, minimumWidth: Dp = DesignTokens.Layout.SheetStatMin,
    maxColumns: Int = 3, gap: Dp = DesignTokens.Spacing.Medium, content: @Composable () -> Unit) {
    Layout(content, modifier) { measurables, constraints ->
        require(constraints.hasBoundedWidth)
        val spacing = gap.roundToPx()
        val columns = ((constraints.maxWidth + spacing) / (minimumWidth.roundToPx() + spacing))
            .coerceIn(1, maxColumns.coerceAtLeast(1)).coerceAtMost(measurables.size.coerceAtLeast(1))
        val width = (constraints.maxWidth - spacing * (columns - 1)) / columns
        val placeables = measurables.map { it.measure(constraints.copy(minWidth = width, maxWidth = width, minHeight = 0)) }
        val groups = balancedColumnBreaks(placeables.map { it.height }, columns, spacing)
        val height = groups.maxOfOrNull { group -> group.sumOf { placeables[it].height } + spacing * (group.count() - 1) } ?: 0
        layout(constraints.maxWidth, constraints.constrainHeight(height)) {
            for ((column, group) in groups.withIndex()) {
                var y = 0
                for (index in group) { placeables[index].placeRelative(column * (width + spacing), y); y += placeables[index].height + spacing }
            }
        }
    }
}
