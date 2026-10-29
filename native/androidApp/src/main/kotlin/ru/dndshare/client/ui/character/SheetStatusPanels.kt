package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SheetStatusPanels(readOnly: Boolean) {
    if (readOnly)
        Text(
            "Режим просмотра",
            Modifier.padding(horizontal = 20.dp, vertical = 4.dp),
            style = ShareTypography.context,
            color = WebPalette.TextSecondary,
        )
}
