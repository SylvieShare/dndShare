package ru.dndshare.client.ui.character

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import coil3.ImageLoader
import ru.dndshare.client.character.*
import ru.dndshare.client.model.HandbookMetadata
import ru.dndshare.client.ui.RichInteractions

/** Navigation/status updates must not manufacture a new document and invalidate every tab. */
@Composable
internal fun rememberPresentedSheet(snapshot: SheetSnapshot?): CharacterSheet? =
    remember(snapshot) { snapshot?.displayed }

@Composable
internal fun rememberSheetRichInteractions(
    sheet: CharacterSheet,
    mechanics: DndDerivedValues,
    metadata: HandbookMetadata,
    images: ImageLoader,
    roll: (SheetRollRequest) -> Unit,
): RichInteractions =
    remember(sheet, mechanics, metadata, images, roll) {
        sheetRichInteractions(sheet, mechanics, metadata, images, roll)
    }
