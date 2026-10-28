package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun ShareSegmentedInput(
    label: String,
    value: String,
    options: List<Pair<String, String>>,
    enabled: Boolean = true,
    change: (String) -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().selectableGroup().alpha(if (enabled) 1f else .55f),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        options.forEach { (key, title) ->
            val selected = value == key
            Surface(
                Modifier.weight(1f)
                    .heightIn(min = 28.dp)
                    .selectable(
                        selected,
                        enabled = enabled,
                        role = Role.RadioButton,
                        onClick = { change(key) },
                    )
                    .semantics { contentDescription = "$label: $title" },
                shape = RoundedCornerShape(6.dp),
                color =
                    if (selected)
                        WebPalette.Accent.copy(alpha = .15f).compositeOver(WebPalette.Raised)
                    else WebPalette.Raised,
                border =
                    BorderStroke(
                        1.dp,
                        if (selected) WebPalette.Accent else WebPalette.BorderStrong,
                    ),
            ) {
                Box(
                    Modifier.padding(horizontal = 4.dp, vertical = 5.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        title,
                        style = fieldTextStyle.copy(fontSize = 10.sp, lineHeight = 14.sp),
                        color = if (selected) WebPalette.AccentSoft else WebPalette.TextMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

@Composable
fun ShareFormSection(label: String, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(
            label.uppercase(),
            style =
                ShareTypography.context.copy(
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = .6.sp,
                ),
            color = WebPalette.TextMuted,
        )
        content()
        HorizontalDivider(color = WebPalette.Border)
    }
}
