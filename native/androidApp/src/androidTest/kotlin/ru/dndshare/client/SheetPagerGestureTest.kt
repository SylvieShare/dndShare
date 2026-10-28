package ru.dndshare.client

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.PagerState
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.*
import kotlinx.coroutines.*
import org.junit.Rule
import org.junit.Test
import ru.dndshare.client.ui.character.*

class SheetPagerGestureTest {
    @get:Rule val animatorScale = AnimatorScaleRule()

    @Test
    fun releaseAndSelectionAcknowledgementKeepBothSwipesMonotonicAndTopAligned() {
        val selected = mutableStateOf(SheetSection.Base)
        val state = AtomicReference<PagerState>()
        val viewport = AtomicReference(Rect.Zero)
        val tops = CopyOnWriteArrayList<Float>()
        val positions = CopyOnWriteArrayList<Pair<Long, Float>>()
        ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                activity.setContent {
                    val scope = rememberCoroutineScope()
                    val sections =
                        listOf(SheetSection.Base, SheetSection.Stats, SheetSection.Weapons)
                    val pager =
                        rememberSheetPager(sections, selected.value) { next ->
                            scope.launch {
                                delay(20)
                                selected.value = next
                            }
                        }
                    SideEffect { state.set(pager) }
                    LaunchedEffect(pager) {
                        while (isActive) withFrameNanos { time ->
                            positions.add(
                                time to pager.currentPage + pager.currentPageOffsetFraction
                            )
                        }
                    }
                    Box(
                        Modifier.fillMaxSize()
                            .windowInsetsPadding(WindowInsets.safeDrawing)
                            .semantics { contentDescription = "Область вкладок" }
                            .onGloballyPositioned { viewport.set(it.boundsInWindow()) }
                    ) {
                        SheetPagerContent(pager, sections, Modifier.fillMaxSize()) { page ->
                            Column(
                                Modifier.fillMaxWidth()
                                    .height(if (page == 0) 100.dp else 420.dp)
                                    .onGloballyPositioned {
                                        tops.add(it.boundsInWindow(clipBounds = false).top)
                                    }
                            ) {
                                Text(sections[page].title)
                            }
                        }
                    }
                }
            }
            TouchRobot.await { viewport.get().width > 0 && state.get() != null }
            TouchRobot.await { TouchRobot.find("Область вкладок") != null }
            val physical = TouchRobot.bounds("Область вкладок")
            val box =
                Rect(
                    physical.left.toFloat(),
                    physical.top.toFloat(),
                    physical.right.toFloat(),
                    physical.bottom.toFloat(),
                )
            var release = 0
            TouchRobot.drag(
                box.left + box.width * .85f,
                box.center.y,
                box.left + box.width * .2f,
                box.center.y,
                500,
            ) {
                release = positions.size
            }
            TouchRobot.await {
                state.get().settledPage == 1 &&
                    !state.get().isScrollInProgress &&
                    selected.value == SheetSection.Stats
            }
            Thread.sleep(150)
            val forward = positions.drop(release)
            assertTrue(
                forward.zipWithNext().all { it.second.second >= it.first.second - .02f },
                "Release must not restart toward the preceding tab: $forward",
            )
            assertTrue(
                forward.zipWithNext().all { (a, b) ->
                    b.first - a.first > 40_000_000 || kotlin.math.abs(b.second - a.second) < .2f
                },
                "No discontinuous jump at release",
            )
            TouchRobot.drag(
                box.left + box.width * .2f,
                box.center.y,
                box.left + box.width * .85f,
                box.center.y,
                500,
            ) {
                release = positions.size
            }
            TouchRobot.await {
                state.get().settledPage == 0 &&
                    !state.get().isScrollInProgress &&
                    selected.value == SheetSection.Base
            }
            val reverse = positions.drop(release)
            assertTrue(
                reverse.zipWithNext().all { it.second.second <= it.first.second + .02f },
                "Reverse swipe must settle once",
            )
            assertTrue(
                tops.isNotEmpty() && tops.all { kotlin.math.abs(it - viewport.get().top) < 3f },
                "Pages with different heights must stay aligned to the top: $tops",
            )
        }
    }

    @Test
    fun aCancelledSwipeKeepsTheSemanticSelection() {
        val selected = mutableStateOf(SheetSection.Base)
        val state = AtomicReference<PagerState>()
        val bounds = AtomicReference(Rect.Zero)
        ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                activity.setContent {
                    val sections = listOf(SheetSection.Base, SheetSection.Stats)
                    val pager = rememberSheetPager(sections, selected.value) { selected.value = it }
                    SideEffect { state.set(pager) }
                    Box(
                        Modifier.fillMaxSize()
                            .windowInsetsPadding(WindowInsets.safeDrawing)
                            .semantics { contentDescription = "Область вкладок" }
                            .onGloballyPositioned { bounds.set(it.boundsInWindow()) }
                    ) {
                        SheetPagerContent(pager, sections, Modifier.fillMaxSize()) {
                            Text(sections[it].title)
                        }
                    }
                }
            }
            TouchRobot.await { bounds.get().width > 0 && state.get() != null }
            TouchRobot.await { TouchRobot.find("Область вкладок") != null }
            val physical = TouchRobot.bounds("Область вкладок")
            val box =
                Rect(
                    physical.left.toFloat(),
                    physical.top.toFloat(),
                    physical.right.toFloat(),
                    physical.bottom.toFloat(),
                )
            TouchRobot.drag(
                box.left + box.width * .7f,
                box.center.y,
                box.left + box.width * .6f,
                box.center.y,
                500,
            )
            TouchRobot.await { !state.get().isScrollInProgress }
            assertEquals(0, state.get().settledPage)
            assertEquals(SheetSection.Base, selected.value)
        }
    }
}
