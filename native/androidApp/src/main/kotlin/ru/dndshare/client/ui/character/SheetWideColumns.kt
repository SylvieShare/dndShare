package ru.dndshare.client.ui.character

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import ru.dndshare.client.ui.designsystem.DesignTokens

internal data class WideSheetColumns(val stats: Dp, val utilities: Dp)

/** The same proportional flex shrink and minimums as the web's three-column sheet. */
internal fun wideSheetColumns(available: Dp): WideSheetColumns {
    val layout = DesignTokens.Layout
    val gap = 30f
    val bases =
        listOf(
            layout.SheetStatsColumn.value,
            layout.SheetMax.value -
                layout.SheetStatsColumn.value -
                layout.SheetUtilitiesColumn.value -
                gap,
            layout.SheetUtilitiesColumn.value,
        )
    val minimums =
        listOf(layout.SheetStatsColumnMin.value, 0f, layout.SheetUtilitiesColumnMin.value)
    val widths = FloatArray(3)
    val active = mutableSetOf(0, 1, 2)
    var remaining = (minOf(available, layout.SheetMax).value - gap).coerceAtLeast(0f)
    while (active.isNotEmpty()) {
        val ratio = (remaining / active.sumOf { bases[it].toDouble() }).toFloat().coerceAtLeast(0f)
        val frozen = active.filter { bases[it] * ratio < minimums[it] }
        if (frozen.isEmpty()) {
            active.forEach { widths[it] = bases[it] * ratio }
            break
        }
        frozen.forEach {
            widths[it] = minimums[it]
            remaining -= minimums[it]
            active.remove(it)
        }
    }
    return WideSheetColumns(widths[0].dp, widths[2].dp)
}
