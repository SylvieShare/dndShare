package ru.dndshare.client.ui.character

import androidx.compose.foundation.pager.PagerState
import androidx.compose.runtime.*
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filterNotNull

/** Store semantic selection only after a gesture or an animated tab change settles. */
@Composable
internal fun rememberSheetPager(
    sections: List<SheetSection>,
    selected: SheetSection,
    select: (SheetSection) -> Unit,
): PagerState {
    val ids = sections.joinToString(":") { it.name }
    // The ViewModel owns the saved semantic section. A second saved numeric index can
    // restore a different section when the tablet's Base page is inserted or removed.
    val pager =
        remember(ids) {
            PagerState(
                currentPage = sections.indexOf(selected).coerceAtLeast(0),
                pageCount = { sections.size },
            )
        }
    val latestSelected by rememberUpdatedState(selected)
    val latestSelect by rememberUpdatedState(select)
    // An acknowledgement of a gesture is not another navigation command.
    val acknowledgement = remember(pager) { arrayOfNulls<SheetSection>(1) }
    LaunchedEffect(pager) {
        snapshotFlow { if (pager.isScrollInProgress) null else pager.settledPage }
            .filterNotNull()
            .distinctUntilChanged()
            .collect { page ->
                traceSheetNavigation {
                    "settled ids=$ids index=$page section=${sections.getOrNull(page)?.name}"
                }
                sections.getOrNull(page)?.let { settled ->
                    if (settled != latestSelected) {
                        acknowledgement[0] = settled
                        latestSelect(settled)
                    }
                }
            }
    }
    LaunchedEffect(pager, selected.name) {
        if (acknowledgement[0] == selected) {
            acknowledgement[0] = null
            return@LaunchedEffect
        }
        val page = sections.indexOf(selected).coerceAtLeast(0)
        traceSheetNavigation {
            "target ids=$ids selected=${selected.name} current=${pager.currentPage} target=${pager.targetPage}"
        }
        if (pager.targetPage != page) pager.animateScrollToPage(page)
    }
    return pager
}

/** Reset the layout's key/index cache together with its state when the section set changes. */
@Composable
internal fun SheetPagerContent(
    pager: PagerState,
    sections: List<SheetSection>,
    modifier: androidx.compose.ui.Modifier = androidx.compose.ui.Modifier,
    userScrollEnabled: Boolean = true,
    beyondViewportPageCount: Int = 1,
    verticalAlignment: androidx.compose.ui.Alignment.Vertical = androidx.compose.ui.Alignment.Top,
    content: @Composable androidx.compose.foundation.pager.PagerScope.(Int) -> Unit,
) {
    key(pager) {
        androidx.compose.foundation.pager.HorizontalPager(
            state = pager,
            modifier = modifier,
            userScrollEnabled = userScrollEnabled,
            beyondViewportPageCount = beyondViewportPageCount,
            verticalAlignment = verticalAlignment,
            key = { sections[it].name },
            pageContent = content,
        )
    }
}
