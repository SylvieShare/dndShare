package ru.dndshare.client.ui.designsystem

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class ShareNavigationItem(val key: String, val label: String)

@Composable
fun ShareIconNavigation(items: List<ShareNavigationItem>, selected: String, onSelect: (String) -> Unit,
    modifier: Modifier = Modifier, compact: Boolean = false, icon: @Composable (String) -> Unit) {
    BoxWithConstraints(if (compact) modifier.fillMaxWidth() else modifier) {
    val gap = 2.dp
    val horizontalPadding = if (compact) 8.dp else 4.dp
    val size = if (compact && items.isNotEmpty()) ((maxWidth - horizontalPadding * 2 - gap * (items.size - 1)) / items.size).coerceAtLeast(44.dp) else 56.dp
    val height = if (compact) 40.dp else 56.dp
    val index = items.indexOfFirst { it.key == selected }.coerceAtLeast(0)
    val x by animateDpAsState((size + gap) * index, label = "Navigation indicator")
    Box(Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = horizontalPadding, vertical = 4.dp).selectableGroup()) {
        if (compact) Box(Modifier.offset(x = x, y = height - 3.dp).width(size).height(3.dp).background(WebPalette.Accent, RoundedCornerShape(5.dp)))
        else Box(Modifier.offset(x = x).size(size).background(WebPalette.Accent, RoundedCornerShape(10.dp)))
        Row(horizontalArrangement = Arrangement.spacedBy(gap)) {
            items.forEach { item ->
                Column(Modifier.width(size).height(height).selectable(item.key == selected, role = Role.Tab,
                    onClick = { onSelect(item.key) }), horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center) {
                    icon(item.key)
                    if (!compact) Text(item.label, maxLines = 1, overflow = TextOverflow.Ellipsis,
                        fontSize = 10.sp, lineHeight = 14.sp, letterSpacing = 0.sp, fontWeight = FontWeight.Bold,
                        color = if (item.key == selected) WebPalette.OnAccent else WebPalette.TextMuted)
                }
            }
        }
    }
}

}
