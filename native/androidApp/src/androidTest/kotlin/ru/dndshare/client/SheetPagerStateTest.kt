package ru.dndshare.client

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerState
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import org.junit.Test
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.client.ui.character.*
import ru.dndshare.client.ui.designsystem.ShareIconNavigation
import ru.dndshare.client.ui.designsystem.ShareNavigationItem
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.*
import kotlin.test.*

class SheetPagerStateTest {
    @Test fun selectedTabIsRevealedInANarrowPhoneBar() {
        val selected = mutableStateOf("0")
        val viewport = AtomicReference(Rect.Zero)
        val lastIcon = AtomicReference(Rect.Zero)
        ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
            activity.onActivity { host -> host.setContent {
                Box(Modifier.width(320.dp).onGloballyPositioned { viewport.set(it.boundsInWindow()) }) {
                    ShareIconNavigation((0..7).map { ShareNavigationItem(it.toString(), "Раздел $it") },
                        selected.value, { selected.value = it }, compact = true) { key ->
                        Box(Modifier.size(22.dp).onGloballyPositioned { if (key == "7") lastIcon.set(it.boundsInWindow()) })
                    }
                }
            } }
            await { viewport.get().width > 0 }
            activity.onActivity { selected.value = "7" }
            await {
                val icon = lastIcon.get(); val bounds = viewport.get()
                icon.width > 0 && icon.left >= bounds.left && icon.right <= bounds.right
            }
        }
    }

    @Test fun semanticSelectionOwnsRestorationAcrossRecreationAndWindowFormats() {
        val format = mutableStateOf(LayoutFormat.Phone)
        val selected = mutableStateOf(SheetSection.Stats)
        val acceptSelection = AtomicBoolean(true)
        val generation = AtomicInteger(0)
        val firstPages = ConcurrentHashMap<Int, Int>()
        val changes = CopyOnWriteArrayList<SheetSection>()
        val state = AtomicReference<PagerState>()
        val scope = AtomicReference<CoroutineScope>()
        val content: @Composable () -> Unit = {
            val sections = sheetSections("DND5", format.value)
            val pager = rememberSheetPager(sections, selected.value) {
                changes.add(it)
                if (acceptSelection.get()) selected.value = it
            }
            val mount = remember { generation.get() }
            val initialPage = remember(pager) { pager.currentPage }
            val coroutine = rememberCoroutineScope()
            SideEffect { firstPages.putIfAbsent(mount, initialPage); state.set(pager); scope.set(coroutine) }
            SheetPagerContent(pager, sections, Modifier.fillMaxSize()) { page -> Text(sections[page].title) }
        }
        ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
            fun install() = activity.onActivity { it.setContent(content = content) }
            install()
            await { state.get()?.settledPage == 1 }
            activity.onActivity { scope.get().launch { state.get().scrollToPage(2) } }
            await { selected.value == SheetSection.Weapons }
            activity.onActivity { scope.get().launch { state.get().scrollToPage(1) } }
            await { selected.value == SheetSection.Stats }
            activity.onActivity { format.value = LayoutFormat.Tablet }
            await { state.get().pageCount == 8 && state.get().settledPage == 1 && state.get().layoutInfo.visiblePagesInfo.any { it.index == 1 } }

            // Simulate a page position whose semantic change has not been committed yet.
            // Restoring that numeric position must not override the saved Stats selection.
            acceptSelection.set(false)
            activity.onActivity { scope.get().launch { state.get().scrollToPage(2) } }
            await { state.get().settledPage == 2 }
            val previous = state.get()
            generation.incrementAndGet()
            activity.recreate()
            install()
            await { state.get() !== previous && firstPages.containsKey(1) }
            assertEquals(1, firstPages[1], "Tablet Stats must be the first restored page, not saved index 2")
            await { state.get().settledPage == 1 }

            changes.clear()
            acceptSelection.set(true)
            activity.onActivity { format.value = LayoutFormat.Phone }
            await { state.get().pageCount == 8 && state.get().settledPage == 1 && state.get().layoutInfo.visiblePagesInfo.any { it.index == 1 } }
            assertEquals(SheetSection.Stats, selected.value)
            assertTrue(changes.all { it == SheetSection.Stats }, "A stale pager must not map its index through another format")
        }
    }

    private fun await(condition: () -> Boolean) {
        val end = System.nanoTime() + 10_000_000_000L
        while (!condition() && System.nanoTime() < end) Thread.sleep(10)
        assertTrue(condition(), "Timed out waiting for the semantic page")
    }
}
