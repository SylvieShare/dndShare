package ru.dndshare.client.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import ru.dndshare.client.model.ItemType
import ru.dndshare.designsystem.ShareTile
import ru.dndshare.designsystem.ShareTypography
import ru.dndshare.designsystem.WebPalette

@Composable
internal fun CollectionTile(
    type: ItemType, count: Int, images: ImageLoader,
    parentName: String?, childNames: String, onClick: () -> Unit,
) {
    val color = catalogueColor(type.color)
    ShareTile(Modifier.fillMaxWidth().heightIn(min = 160.dp), onClick = onClick, tint = color) {
        Box(Modifier.fillMaxWidth()) {
            type.iconImageUrl?.let { url ->
                AsyncImage(url, null, imageLoader = images, contentScale = ContentScale.Fit,
                    alpha = .78f, modifier = Modifier.align(Alignment.CenterEnd).size(96.dp))
            }
            // ShareTile supplies 16 dp padding. The minimum can grow with wrapped/scaled text.
            Column(Modifier.fillMaxWidth().heightIn(min = 128.dp).padding(end = 118.dp),
                verticalArrangement = Arrangement.SpaceBetween) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    val relation = parentName?.let { "Раздел «$it»" }
                        ?: childNames.takeIf { it.isNotBlank() }?.let { "Основной каталог" }
                    relation?.let {
                        Text(it.uppercase(), style = MaterialTheme.typography.labelSmall,
                            fontSize = 9.sp, lineHeight = 12.sp, fontWeight = FontWeight.ExtraBold, color = color)
                    }
                    Text(type.name, style = ShareTypography.card.copy(fontSize = 22.sp, lineHeight = 26.4.sp))
                    type.description?.takeIf { it.isNotBlank() }?.let {
                        Text(it, style = MaterialTheme.typography.bodySmall, fontSize = 12.sp,
                            lineHeight = 16.8.sp, color = WebPalette.TextMuted)
                    }
                    if (childNames.isNotBlank()) Text("Подразделы: $childNames",
                        style = MaterialTheme.typography.bodySmall, fontSize = 10.sp,
                        lineHeight = 13.5.sp, fontWeight = FontWeight.SemiBold, color = WebPalette.TextSecondary)
                }
                FlowRow(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(count.toString(), Modifier.alignByBaseline(), style = MaterialTheme.typography.headlineLarge,
                        fontSize = 32.sp, lineHeight = 32.sp, fontWeight = FontWeight.SemiBold, color = color)
                    Text("записей", Modifier.alignByBaseline(), style = MaterialTheme.typography.bodySmall,
                        fontSize = 12.sp, color = WebPalette.TextMuted)
                }
            }
        }
    }
}
