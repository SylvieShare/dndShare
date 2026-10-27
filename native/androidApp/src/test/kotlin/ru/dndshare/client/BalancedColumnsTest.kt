package ru.dndshare.client

import ru.dndshare.client.ui.designsystem.balancedColumnBreaks
import ru.dndshare.client.ui.character.statColumnOrder

import kotlin.test.*
import org.junit.Test

class BalancedColumnsTest {
    @Test fun sixCharacteristicsUseTwoEquallyFilledColumns() {
        val heights = listOf(150, 218, 116, 286, 286, 252)
        val order = statColumnOrder(heights, 2)
        assertEquals(heights.indices.toList(), order.sorted())
        assertEquals(654, order.take(3).sumOf(heights::get))
        assertEquals(654, order.drop(3).sumOf(heights::get))
    }
    @Test fun differentTileHeightsKeepReadingOrderAndBalancedColumns() {
        val heights = listOf(100, 300, 100, 200, 100, 200)
        val groups = balancedColumnBreaks(heights, 3, 0)
        assertEquals(heights.indices.toList(), groups.flatMap { it.toList() })
        assertEquals(listOf(400, 300, 300), groups.map { range -> range.sumOf(heights::get) })
    }
    @Test fun oneColumnAndFewItemsDoNotCreateEmptyColumns() {
        assertEquals(listOf(0..2), balancedColumnBreaks(listOf(10, 20, 30), 1, 12))
        assertEquals(listOf(0..0, 1..1), balancedColumnBreaks(listOf(10, 20), 3, 12))
        assertTrue(balancedColumnBreaks(emptyList(), 3, 12).isEmpty())
    }
}
