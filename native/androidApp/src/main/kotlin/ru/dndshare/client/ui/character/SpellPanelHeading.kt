package ru.dndshare.client.ui.character

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SpellPanelHeading(title: String, editLabel: String, onEdit: (() -> Unit)?) {
    Row(
        Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            title.uppercase(),
            Modifier.weight(1f, false),
            style =
                ShareTypography.context.copy(
                    fontSize = 12.sp,
                    lineHeight = 16.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = .6.sp,
                ),
            color = WebPalette.TextMuted,
        )
        if (onEdit != null)
            Box(
                Modifier.size(24.dp)
                    .semantics { contentDescription = editLabel }
                    .clickable(onClick = onEdit),
                contentAlignment = Alignment.Center,
            ) {
                CompositionLocalProvider(LocalContentColor provides WebPalette.TextMuted) {
                    AppGlyph(Glyph.Edit, Modifier.size(14.dp))
                }
            }
    }
}
