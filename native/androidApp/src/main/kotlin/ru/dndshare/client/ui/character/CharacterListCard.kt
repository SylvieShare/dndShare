package ru.dndshare.client.ui.character

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun CharacterListCard(
    character: Character,
    images: ImageLoader,
    busy: Boolean,
    open: () -> Unit,
    clone: () -> Unit,
    delete: () -> Unit,
) {
    var menu by remember { mutableStateOf(false) }
    val values = character.data["values"].objectValue()
    val subtitle =
        listOf(
                values["race"].objectValue().label(),
                values["classes"].arrayValue().joinToString(" / ") { it.objectValue().label() },
            )
            .filter(String::isNotBlank)
            .joinToString(" · ")
            .ifBlank { values.text("persona") }
    ShareTile(
        onClick = open,
        framed = false,
        contentPadding = PaddingValues(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.heightIn(min = 100.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            val picture =
                character.iconImageUrl
                    ?: values["ava"].objectValue().text("url").takeIf(String::isNotBlank)
            if (picture != null)
                AsyncImage(
                    picture,
                    null,
                    imageLoader = images,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(84.dp, 100.dp).clip(RoundedCornerShape(8.dp)),
                )
            else
                Box(
                    Modifier.size(84.dp, 100.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(WebPalette.Accent.copy(alpha = .35f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(character.name.take(1), style = ShareTypography.title)
                }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        character.name,
                        Modifier.weight(1f),
                        style =
                            ShareTypography.header.copy(
                                fontSize = 16.sp,
                                lineHeight = 21.sp,
                                fontWeight = FontWeight.SemiBold,
                            ),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Box {
                        IconButton(
                            onClick = { menu = true },
                            enabled = !busy,
                            modifier =
                                Modifier.size(28.dp).semantics {
                                    contentDescription = "Действия: ${character.name}"
                                },
                        ) {
                            Text("⋯", style = ShareTypography.section)
                        }
                        DropdownMenu(menu, { menu = false }) {
                            DropdownMenuItem(
                                text = { Text("Клонировать") },
                                onClick = {
                                    menu = false
                                    clone()
                                },
                            )
                            DropdownMenuItem(
                                text = { Text("Удалить", color = WebPalette.Danger) },
                                onClick = {
                                    menu = false
                                    delete()
                                },
                            )
                        }
                    }
                }
                if (subtitle.isNotBlank())
                    Text(
                        subtitle,
                        style = ShareTypography.context.copy(fontSize = 12.sp, lineHeight = 16.sp),
                        color = WebPalette.TextSecondary,
                    )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    if (character.level != "—") ShareBadge("Ур. ${character.level}")
                    character.sourceVersion?.let {
                        Text(
                            "Редакция $it",
                            style =
                                ShareTypography.context.copy(
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                ),
                            color = WebPalette.AccentSoft,
                        )
                    }
                    val changed = relativeCharacterDate(character.changedAt)
                    if (changed.isNotBlank())
                        Text(changed, style = ShareTypography.context, color = WebPalette.TextMuted)
                }
                character.sessions.firstOrNull()?.let { session ->
                    Text(
                        listOf(
                                session.name,
                                session.chapterNumber?.let { "Глава $it" },
                                session.chapterName,
                            )
                            .filterNotNull()
                            .filter(String::isNotBlank)
                            .joinToString(" · "),
                        style = ShareTypography.context,
                    )
                }
            }
        }
    }
}

internal fun relativeCharacterDate(value: String, now: Instant = Instant.now()): String {
    val date = runCatching { Instant.parse(value) }.getOrNull() ?: return ""
    val minutes = java.time.Duration.between(date, now).toMinutes().coerceAtLeast(0)
    return when {
        minutes < 2 -> "только что"
        minutes < 60 -> "$minutes мин назад"
        minutes < 1440 -> "${minutes / 60} ч назад"
        minutes < 10080 -> "${minutes / 1440} дн назад"
        else ->
            DateTimeFormatter.ofPattern("d MMM", java.util.Locale.forLanguageTag("ru"))
                .withZone(ZoneId.systemDefault())
                .format(date)
    }
}
