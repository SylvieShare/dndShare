package ru.dndshare.client.ui

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import ru.dndshare.client.model.ItemType
import ru.dndshare.client.ui.designsystem.*

@Stable
internal class HandbookHeadingState {
    var type by mutableStateOf<ItemType?>(null)
        private set
    private var owner: Any? = null
    private var home: () -> Unit = {}
    fun publish(owner: Any, type: ItemType?, home: () -> Unit) {
        this.owner = owner
        this.home = home
        this.type = type
    }
    fun clear(owner: Any) { if (this.owner === owner) { type = null; home = {} } }
    fun goHome() = home()
}

@Composable
internal fun HandbookHeading(type: ItemType?, images: ImageLoader, home: () -> Unit) {
    Row(Modifier.fillMaxWidth().animateContentSize(), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(DesignTokens.Spacing.Small)) {
        Text("Справочник", modifier = if (type != null) Modifier.clickable(role = Role.Button, onClickLabel = "К коллекциям", onClick = home)
            else Modifier, style = ShareTypography.header,
            maxLines = 1, color = WebPalette.Text)
        if (type != null) {
            Text("·", color = WebPalette.TextMuted)
            if (type.iconImageUrl != null) AsyncImage(type.iconImageUrl, null, imageLoader = images,
                contentScale = ContentScale.Fit, modifier = Modifier.size(22.dp))
            else AppGlyph(Glyph.Book, Modifier.size(22.dp))
            Text(type.name, Modifier.weight(1f), style = ShareTypography.header,
                maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}
