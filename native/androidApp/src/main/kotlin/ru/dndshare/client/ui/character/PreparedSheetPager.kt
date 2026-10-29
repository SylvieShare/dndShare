package ru.dndshare.client.ui.character

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.PagerState
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.hideFromAccessibility
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import ru.dndshare.client.ui.designsystem.*

/** Every semantic tab remains mounted, including tabs reached directly from the subheader. */
@Composable
internal fun PreparedSheetPager(
    pager: PagerState,
    sections: List<SheetSection>,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    active: Boolean = true,
    fillHeight: Boolean = true,
    content: @Composable (SheetSection) -> Unit,
) {
    val panes = rememberSaveableStateHolder()
    val heights = remember { mutableStateMapOf<String, Int>() }
    val density = LocalDensity.current
    val measuredHeight = if (fillHeight) null else heights[sections[pager.currentPage].name]
    val bounds =
        if (fillHeight) modifier
        else
            modifier
                .animateContentSize()
                .height(measuredHeight?.let { with(density) { it.toDp() } } ?: 400.dp)
    val queue =
        rememberSharePreparationQueue(
            priority = { sections.getOrNull(pager.targetPage)?.name },
            busy = { !active || !enabled || pager.isScrollInProgress },
        )
    SheetPagerContent(
        pager,
        sections,
        bounds,
        userScrollEnabled = enabled,
        beyondViewportPageCount = (sections.size - 1).coerceAtLeast(0),
    ) { page ->
        val section = sections[page]
        panes.SaveableStateProvider(section.name) {
            SharePreparedContent(
                section.name,
                queue,
                Modifier.fillMaxSize().semantics {
                    if (pager.currentPage != page) hideFromAccessibility()
                },
                placeholder = { SheetPageSkeleton() },
            ) {
                Box(
                    if (fillHeight) Modifier.fillMaxSize()
                    else
                        Modifier.fillMaxWidth().wrapContentHeight(unbounded = true).onSizeChanged {
                            heights[section.name] = it.height
                        }
                ) {
                    content(section)
                }
            }
        }
    }
}
