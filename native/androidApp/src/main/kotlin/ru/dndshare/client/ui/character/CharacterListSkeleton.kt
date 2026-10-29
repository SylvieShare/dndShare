package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun CharacterListSkeleton() {
    ShareTile(
        Modifier.fillMaxWidth().semantics { stateDescription = "Загружаем персонажей" },
        framed = false,
        contentPadding = PaddingValues(12.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            ShareSkeletonBlock(Modifier.width(84.dp), 100.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                ShareSkeletonBlock(Modifier.fillMaxWidth(.7f), 18.dp)
                ShareSkeletonBlock(Modifier.fillMaxWidth(), 12.dp)
                ShareSkeletonBlock(Modifier.fillMaxWidth(.5f), 12.dp)
            }
        }
    }
}
