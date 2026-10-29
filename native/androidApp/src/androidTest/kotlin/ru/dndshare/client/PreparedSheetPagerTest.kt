package ru.dndshare.client

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.PagerState
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.*
import kotlin.test.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import org.junit.Test
import ru.dndshare.client.ui.DndTheme
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.client.ui.character.*

class PreparedSheetPagerTest {
    @Test
    fun everyTabIsPreparedBeforeVisitAndSurvivesDirectJumpsWithFreshData() {
        val mounts = ConcurrentHashMap<SheetSection, Any>()
        val seen = ConcurrentHashMap<SheetSection, String>()
        val disposed = AtomicInteger()
        val value = mutableStateOf("first")
        val selected = mutableStateOf(SheetSection.Base)
        val state = AtomicReference<PagerState>()
        val scope = AtomicReference<CoroutineScope>()
        val sections = sheetSections("DND5", LayoutFormat.Phone)
        ActivityScenario.launch(ComponentActivity::class.java).use { activity ->
            activity.onActivity { host ->
                host.setContent {
                    DndTheme {
                        val pager =
                            rememberSheetPager(sections, selected.value) { selected.value = it }
                        val coroutine = rememberCoroutineScope()
                        SideEffect {
                            state.set(pager)
                            scope.set(coroutine)
                        }
                        PreparedSheetPager(pager, sections, Modifier.fillMaxSize()) { section ->
                            val identity = remember { Any() }
                            val text = value.value
                            DisposableEffect(Unit) {
                                assertNull(
                                    mounts.putIfAbsent(section, identity),
                                    "Tab was composed again",
                                )
                                onDispose { disposed.incrementAndGet() }
                            }
                            SideEffect { seen[section] = text }
                            Column(Modifier.fillMaxWidth().height(300.dp)) {
                                Text(section.title + text)
                            }
                        }
                    }
                }
            }
            await { mounts.size == sections.size }
            val original = mounts.toMap()
            assertEquals(0, state.get().settledPage)
            activity.onActivity { selected.value = SheetSection.Journal }
            await {
                state.get().settledPage == sections.lastIndex && !state.get().isScrollInProgress
            }
            activity.onActivity { value.value = "updated" }
            await { seen.size == sections.size && seen.values.all { it == "updated" } }
            activity.onActivity { selected.value = SheetSection.Stats }
            await { state.get().settledPage == 1 && !state.get().isScrollInProgress }
            assertEquals(original, mounts.toMap())
            assertEquals(0, disposed.get())
        }
        await { disposed.get() == sections.size }
    }

    private fun await(test: () -> Boolean) {
        val end = System.nanoTime() + 15_000_000_000
        while (!test()) {
            if (System.nanoTime() > end) error("Prepared pager did not settle")
            Thread.sleep(25)
        }
    }
}
