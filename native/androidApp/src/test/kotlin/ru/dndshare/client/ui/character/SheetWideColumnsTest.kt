package ru.dndshare.client.ui.character

import androidx.compose.ui.unit.dp
import kotlin.test.*
import org.junit.Test

class SheetWideColumnsTest {
    @Test
    fun fullReferenceAndTheSmallestDesktopKeepUsableContentSpace() {
        val full = wideSheetColumns(1390.dp)
        assertEquals(300.dp, full.stats)
        assertEquals(360.dp, full.utilities)
        val narrow = wideSheetColumns(976.dp)
        assertEquals(280.dp, narrow.stats)
        assertEquals(280.dp, narrow.utilities)
        assertEquals(386f, 976 - 30 - narrow.stats.value - narrow.utilities.value)
        val between = wideSheetColumns(1200.dp)
        assertEquals(280.dp, between.stats)
        assertEquals(302.26416f, between.utilities.value, .01f)
    }
}
