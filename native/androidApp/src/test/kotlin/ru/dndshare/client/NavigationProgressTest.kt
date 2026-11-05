package ru.dndshare.client

import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.ui.designsystem.navigationFrame

class NavigationProgressTest {
    @Test fun widthsAndLabelsFollowFractionalPositionAndKeepStripWidthConstant() {
        for (position in listOf(0f, .25f, .49f, .5f, .51f, .75f, 1f)) {
            val frame = navigationFrame(8, position, 44f, 40f, 2f)
            assertEquals(1f - position, frame.items[0].weight, .0001f)
            assertEquals(position, frame.items[1].weight, .0001f)
            assertEquals(44f + 40f * position, frame.items[1].width, .0001f)
            assertEquals(132f, frame.items[2].x, .0001f)
            assertEquals(406f, frame.items.last().x + frame.items.last().width, .0001f)
        }
    }

    @Test fun midpointHasNoJumpWhenThePagerChangesItsIntegerPage() {
        val before = navigationFrame(8, 0 + .49f, 44f, 40f, 2f)
        val after = navigationFrame(8, 1 - .49f, 44f, 40f, 2f)
        assertEquals(-.8f, after.items[0].width - before.items[0].width, .001f)
        assertEquals(-.8f, after.items[1].x - before.items[1].x, .001f)
        val middle = navigationFrame(8, .5f, 44f, 40f, 2f)
        assertEquals(64f, middle.indicatorWidth)
        assertEquals(33f, middle.indicatorX)
    }

    @Test fun widerNavigationKeepsFixedItemsAndMovesOnlyTheIndicatorAndTint() {
        val middle = navigationFrame(8, 2.5f, 56f, 0f, 2f)
        assertTrue(middle.items.all { it.width == 56f })
        assertEquals(145f, middle.indicatorX)
        assertEquals(56f, middle.indicatorWidth)
        assertEquals(listOf(0f, 0f, .5f, .5f, 0f, 0f, 0f, 0f), middle.items.map { it.weight })
    }

    @Test fun overscrollAndEmptyListsHaveStableEndpoints() {
        assertEquals(1f, navigationFrame(8, -.2f, 44f, 40f, 2f).items.first().weight)
        assertEquals(1f, navigationFrame(8, 7.2f, 44f, 40f, 2f).items.last().weight)
        assertTrue(navigationFrame(0, 0f, 44f, 40f, 2f).items.isEmpty())
    }
}
