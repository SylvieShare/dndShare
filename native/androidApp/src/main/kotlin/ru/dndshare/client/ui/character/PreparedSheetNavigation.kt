package ru.dndshare.client.ui.character

import androidx.compose.foundation.pager.PagerState
import androidx.compose.runtime.Composable
import coil3.ImageLoader
import ru.dndshare.client.character.CharacterSheet
import ru.dndshare.client.ui.LayoutFormat

/** Observe the moving pager in header scopes, not in the whole sheet/provider tree. */
@Composable
internal fun PreparedSheetHeader(
    sheet: CharacterSheet?,
    format: LayoutFormat,
    sections: List<SheetSection>,
    pager: PagerState?,
    fallback: SheetSection,
    images: ImageLoader,
    select: (SheetSection) -> Unit,
    close: () -> Unit,
    backTitle: String,
    menu: (() -> Unit)? = null,
    navigationInHeader: Boolean = true,
    actions: (@Composable () -> Unit)? = null,
) {
    CharacterSheetHeader(
        sheet,
        format,
        sections,
        pager?.let { sections.getOrNull(it.currentPage) } ?: fallback,
        images,
        select,
        close,
        backTitle,
        menu,
        navigationInHeader,
        actions,
    )
}

@Composable
internal fun PreparedSheetNavigation(
    sections: List<SheetSection>,
    pager: PagerState,
    images: ImageLoader,
    select: (SheetSection) -> Unit,
    compact: Boolean = false,
    template: String = "DND5",
    pill: Boolean = false,
) {
    SheetNavigation(
        sections,
        sections[pager.currentPage],
        images,
        select,
        compact = compact,
        template = template,
        pill = pill,
    )
}
