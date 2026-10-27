package ru.dndshare.client.ui.character

import androidx.compose.foundation.pager.PagerState
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.runtime.*
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop

/** Store semantic selection only after a gesture or an animated tab change settles. */
@Composable
internal fun rememberSheetPager(sections: List<SheetSection>, selected: SheetSection, select: (SheetSection) -> Unit): PagerState {
    val ids = sections.joinToString(":") { it.name }
    val pager = key(ids) { rememberPagerState(initialPage = sections.indexOf(selected).coerceAtLeast(0), pageCount = { sections.size }) }
    val latestSections by rememberUpdatedState(sections)
    val latestSelect by rememberUpdatedState(select)
    LaunchedEffect(pager) {
        snapshotFlow { pager.settledPage }.distinctUntilChanged().drop(1).collect { page ->
            latestSections.getOrNull(page)?.let(latestSelect)
        }
    }
    LaunchedEffect(pager, selected.name) {
        val page = sections.indexOf(selected).coerceAtLeast(0)
        if (pager.targetPage != page) pager.animateScrollToPage(page)
    }
    return pager
}
