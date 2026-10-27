package ru.dndshare.client.ui.character

import androidx.compose.foundation.pager.PagerState
import androidx.compose.runtime.*
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop

/** Store semantic selection only after a gesture or an animated tab change settles. */
@Composable
internal fun rememberSheetPager(sections: List<SheetSection>, selected: SheetSection, select: (SheetSection) -> Unit): PagerState {
    val ids = sections.joinToString(":") { it.name }
    // The ViewModel owns the saved semantic section. A second saved numeric index can
    // restore a different section when the tablet's Base page is inserted or removed.
    val pager = remember(ids) { PagerState(currentPage = sections.indexOf(selected).coerceAtLeast(0), pageCount = { sections.size }) }
    val latestSelect by rememberUpdatedState(select)
    LaunchedEffect(pager) {
        snapshotFlow { pager.settledPage }.distinctUntilChanged().drop(1).collect { page ->
            traceSheetNavigation { "settled ids=$ids index=$page section=${sections.getOrNull(page)?.name}" }
            sections.getOrNull(page)?.let(latestSelect)
        }
    }
    LaunchedEffect(pager, selected.name) {
        val page = sections.indexOf(selected).coerceAtLeast(0)
        traceSheetNavigation { "target ids=$ids selected=${selected.name} current=${pager.currentPage} target=${pager.targetPage}" }
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
    verticalAlignment: androidx.compose.ui.Alignment.Vertical = androidx.compose.ui.Alignment.CenterVertically,
    content: @Composable androidx.compose.foundation.pager.PagerScope.(Int) -> Unit,
) {
    key(pager) {
        androidx.compose.foundation.pager.HorizontalPager(
            state = pager, modifier = modifier, userScrollEnabled = userScrollEnabled,
            beyondViewportPageCount = beyondViewportPageCount, verticalAlignment = verticalAlignment,
            key = { sections[it].name }, pageContent = content,
        )
    }
}
