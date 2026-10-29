package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SheetPageSkeleton(modifier: Modifier = Modifier) {
    Column(
        modifier.fillMaxWidth().padding(DesignTokens.Spacing.Page).semantics {
            stateDescription = "Загружаем раздел персонажа"
            liveRegion = LiveRegionMode.Polite
        },
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        SheetItemSkeleton()
        ShareTile(framed = false) {
            ShareSkeletonBlock(Modifier.fillMaxWidth(.4f), 16.dp)
            repeat(3) { ShareSkeletonBlock(Modifier.fillMaxWidth(), 28.dp) }
        }
        SheetItemSkeleton()
    }
}

@Composable
internal fun SheetItemSkeleton(modifier: Modifier = Modifier) {
    ShareTile(
        modifier.fillMaxWidth().semantics { stateDescription = "Загружаем запись" },
        framed = false,
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            ShareSkeletonBlock(Modifier.width(56.dp), 56.dp, round = true)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                ShareSkeletonBlock(Modifier.fillMaxWidth(.7f), 18.dp)
                ShareSkeletonBlock(Modifier.fillMaxWidth(), 12.dp)
                ShareSkeletonBlock(Modifier.fillMaxWidth(.5f), 12.dp)
            }
        }
    }
}
