package ru.dndshare.client

import android.graphics.Bitmap
import android.graphics.Rect
import android.os.SystemClock
import android.view.accessibility.AccessibilityNodeInfo
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.PagerState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import coil3.ImageLoader
import coil3.svg.SvgDecoder
import java.io.File
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.abs
import kotlin.test.*
import org.junit.Rule
import org.junit.Test
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.client.ui.character.*
import ru.dndshare.client.ui.designsystem.*

class SheetTabbarGestureTest {
    @get:Rule val animations = AnimatorScaleRule()

    @Test fun phoneStripFollowsHeldSwipes() = verifyAtWidth(390)
    @Test fun tabletStripFollowsHeldSwipes() = verifyAtWidth(834)
    @Test fun wideStripFollowsHeldSwipes() = verifyAtWidth(1390)

    private fun verifyAtWidth(size: Int) {
        val instrument = InstrumentationRegistry.getInstrumentation()
        val images = ImageLoader.Builder(instrument.targetContext).components { add(SvgDecoder.Factory()) }.build()
        val width = mutableIntStateOf(size)
        val selected = mutableStateOf(SheetSection.Base)
        val state = AtomicReference<PagerState>()
        val sections = sheetSections("DND5", LayoutFormat.Phone)
        try {
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { host -> host.setContent {
                    ShareTheme {
                        CompositionLocalProvider(LocalDensity provides Density(1f, 1f)) {
                            Surface(color = WebPalette.Background, contentColor = WebPalette.Text) {
                                val pager = rememberSheetPager(sections, selected.value) { selected.value = it }
                                SideEffect { state.set(pager) }
                                Column(Modifier.width(width.intValue.dp).fillMaxHeight().windowInsetsPadding(WindowInsets.safeDrawing)) {
                                    ShareSubheader(surfaceColor = WebPalette.Raised, cornerRadius = DesignTokens.Radius.Tile,
                                        horizontalInset = DesignTokens.Spacing.Page, contentPadding = PaddingValues(0.dp)) {
                                        PreparedSheetNavigation(sections, pager, images, { selected.value = it },
                                            compact = width.intValue < 600, pill = true)
                                    }
                                    SheetPagerContent(pager, sections, Modifier.weight(1f).fillMaxWidth()
                                        .semantics { contentDescription = "Свайп содержимого" }) { page ->
                                        Box(Modifier.fillMaxSize().padding(20.dp)) { Text("Страница ${sections[page].title}") }
                                    }
                                }
                            }
                        }
                    }
                } }

                fun tab(label: String): AccessibilityNodeInfo {
                    var node = requireNotNull(TouchRobot.find(label))
                    node.refresh()
                    // Android omits ACTION_CLICK on an already selected tab.
                    while (!node.isClickable && !node.isSelected && node.parent != null) {
                        node = node.parent
                        node.refresh()
                    }
                    return node
                }
                fun bounds(label: String) = Rect().also { area ->
                    val node = tab(label)
                    node.refresh() // Refresh geometry; Android caches bounds while the finger is held.
                    node.getBoundsInScreen(area)
                }
                fun awaitPage(index: Int) = TouchRobot.await("Page $index settled") {
                    state.get()?.let { !it.isScrollInProgress && it.settledPage == index } == true && selected.value == sections[index]
                }
                fun capture(name: String) {
                    if (InstrumentationRegistry.getArguments().getString("captureTabbar") != "true") return
                    val bitmap = requireNotNull(instrument.uiAutomation.takeScreenshot())
                    try {
                        File(instrument.targetContext.getExternalFilesDir(null), "tabbar-$name.png").outputStream().use {
                            bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)
                        }
                    } finally { bitmap.recycle() }
                }

                run {
                    awaitPage(0)
                    TouchRobot.await { TouchRobot.find("Свайп содержимого") != null && TouchRobot.find("Статы") != null }
                    TouchRobot.await("Resized viewport") { TouchRobot.bounds("Свайп содержимого").width() == size }
                    val area = TouchRobot.bounds("Свайп содержимого")
                    fun swipe(reverse: Boolean, distance: Float, expectedSelection: SheetSection) {
                        val start = if (reverse) .15f else .85f
                        val end = start + if (reverse) distance else -distance
                        TouchRobot.drag(area.left + area.width() * start, area.exactCenterY(),
                            area.left + area.width() * end, area.exactCenterY(), 650) {
                            instrument.waitForIdleSync()
                            val pager = state.get()
                            val position = pager.currentPage + pager.currentPageOffsetFraction
                            assertTrue(position in .1f.. .9f, "The finger is still between pages: $position")
                            assertEquals(expectedSelection, selected.value, "Dragging must not commit the page")
                            val chosen = tab(expectedSelection.title)
                            assertTrue(chosen.isSelected, "Selection ${pager.settledPage}: $chosen")
                            val first = bounds("База")
                            val second = bounds("Статы")
                            if (size < 600) {
                                assertTrue(abs(first.width() - (84f - 40f * position)) <= 2f, "Outgoing tab follows $position: $first")
                                assertTrue(abs(second.width() - (44f + 40f * position)) <= 2f, "Incoming tab follows $position: $second")
                            } else {
                                assertEquals(56, first.width())
                                assertEquals(56, second.width())
                            }
                            capture("$size-${if (reverse) "reverse" else distance.toString()}")
                            SystemClock.sleep(160)
                            assertEquals(first, bounds("База"), "A paused finger must freeze the strip")
                            assertEquals(second, bounds("Статы"))
                        }
                    }
                    swipe(false, .3f, SheetSection.Base)
                    awaitPage(0)
                    swipe(false, .65f, SheetSection.Base)
                    awaitPage(1)
                    swipe(true, .65f, SheetSection.Stats)
                    awaitPage(0)
                    assertTrue(tab("Статы").performAction(AccessibilityNodeInfo.ACTION_CLICK))
                    assertTrue(tab("Магия").performAction(AccessibilityNodeInfo.ACTION_CLICK))
                    awaitPage(3)
                    assertTrue(tab("Магия").isSelected)
                }
            }
        } finally { images.shutdown() }
    }
}
