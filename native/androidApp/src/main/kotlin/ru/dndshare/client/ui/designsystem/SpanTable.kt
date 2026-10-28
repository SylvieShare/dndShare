package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp

data class ShareTableCell<T>(
    val row: Int,
    val column: Int,
    val rows: Int,
    val columns: Int,
    val value: T,
    val header: Boolean = false,
)

/** Measures spanning cells before distributing their height over the affected rows. */
@Composable
fun <T> ShareSpanTable(
    cells: List<ShareTableCell<T>>,
    columns: Int,
    content: @Composable (T) -> Unit,
) {
    Box(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())) {
        SubcomposeLayout { _ ->
            val columnWidth = 160.dp.roundToPx()
            val rowCount = cells.maxOfOrNull { it.row + it.rows } ?: 0
            val heights = IntArray(rowCount) { 40.dp.roundToPx() }
            val measured = cells.mapIndexed { index, cell ->
                subcompose(index) {
                        Box(
                            Modifier.background(
                                    if (cell.header) WebPalette.Raised else WebPalette.Surface
                                )
                                .padding(12.dp)
                        ) {
                            content(cell.value)
                        }
                    }
                    .single()
                    .measure(Constraints.fixedWidth(columnWidth * cell.columns))
            }
            cells.indices
                .sortedBy { cells[it].rows }
                .forEach { i ->
                    val cell = cells[i]
                    val available = (cell.row until cell.row + cell.rows).sumOf { heights[it] }
                    val missing = (measured[i].height - available).coerceAtLeast(0)
                    if (missing > 0)
                        for (r in cell.row until cell.row + cell.rows) {
                            heights[r] +=
                                missing / cell.rows +
                                    if (r - cell.row < missing % cell.rows) 1 else 0
                        }
                }
            val offsets = IntArray(rowCount + 1)
            heights.indices.forEach { offsets[it + 1] = offsets[it] + heights[it] }
            val final = cells.mapIndexed { index, cell ->
                subcompose("fill:$index") {
                        Box(
                            Modifier.background(
                                    if (cell.header) WebPalette.Raised else WebPalette.Surface
                                )
                                .border(1.dp, WebPalette.Border)
                                .padding(12.dp)
                        ) {
                            content(cell.value)
                        }
                    }
                    .single()
                    .measure(
                        Constraints.fixed(
                            columnWidth * cell.columns,
                            offsets[cell.row + cell.rows] - offsets[cell.row],
                        )
                    )
            }
            layout(columnWidth * columns, offsets.last()) {
                cells.forEachIndexed { index, cell ->
                    final[index].placeRelative(columnWidth * cell.column, offsets[cell.row])
                }
            }
        }
    }
}
