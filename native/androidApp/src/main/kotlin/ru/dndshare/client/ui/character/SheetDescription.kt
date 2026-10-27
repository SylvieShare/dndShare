package ru.dndshare.client.ui.character

import androidx.compose.runtime.Composable
import ru.dndshare.client.ui.RichDescription

@Composable
internal fun SheetDescription(html: String) {
    val context = LocalCharacterSheet.current
    RichDescription(html, openItem = context.openItem)
}
