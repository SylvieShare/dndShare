package ru.dndshare.designsystem

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

@Composable
fun ShareContentRow(
    title: String, alternate: String, subtitle: String, selected: Boolean, onClick: () -> Unit,
    modifier: Modifier = Modifier, metric: String = "", badges: List<String> = emptyList(),
) {
    Surface(onClick, modifier.fillMaxWidth().semantics { this.selected = selected }, shape = RoundedCornerShape(9.dp),
        color = if (selected) MaterialTheme.colorScheme.secondaryContainer else WebPalette.Surface,
        border = BorderStroke(1.dp, if (selected) WebPalette.Accent.copy(alpha = .38f) else WebPalette.Border)) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 12.dp).heightIn(min = 48.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            if (metric.isNotBlank()) Text(metric, Modifier.widthIn(min = 24.dp), color = WebPalette.AccentSoft,
                style = MaterialTheme.typography.titleLarge)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(title, style = ShareTypography.row)
                if (alternate.isNotBlank()) Text(alternate, style = MaterialTheme.typography.labelSmall, color = WebPalette.TextMuted,
                    maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (subtitle.isNotBlank()) Text(subtitle, style = MaterialTheme.typography.bodySmall, color = WebPalette.TextSecondary,
                    maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            badges.forEach { ShareBadge(it) }
            AppGlyph(Glyph.Chevron, Modifier.size(16.dp))
        }
    }
}
