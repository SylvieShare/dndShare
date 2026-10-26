package ru.dndshare.client.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.lerp
import androidx.compose.ui.unit.sp
import ru.dndshare.client.R
import kotlin.math.roundToInt

/** One continuous layout keeps the branding in place while the keyboard changes available height. */
@Composable
internal fun LoginBrand(collapse: Float) {
    Layout(
        modifier = Modifier.fillMaxWidth(),
        content = {
            Image(painterResource(R.drawable.brand_mark), contentDescription = null)
            Column(verticalArrangement = Arrangement.spacedBy(lerp(12.dp, 4.dp, collapse))) {
                Text("DnD Share", style = MaterialTheme.typography.headlineLarge.copy(
                    fontSize = (32 - 10 * collapse).sp, lineHeight = (40 - 12 * collapse).sp,
                ))
                Text("Ваши персонажи и справочник — под рукой.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyLarge.copy(
                        fontSize = (16 - 2 * collapse).sp, lineHeight = (24 - 4 * collapse).sp,
                    ))
            }
        },
    ) { children, constraints ->
        val width = constraints.maxWidth
        val iconSize = lerp(76.dp, 52.dp, collapse).roundToPx()
        val icon = children[0].measure(Constraints.fixed(iconSize, iconSize))
        val textX = ((iconSize + 14.dp.roundToPx()) * collapse).roundToInt()
        val text = children[1].measure(Constraints(maxWidth = (width - textX).coerceAtLeast(0)))
        val textY = ((iconSize + 20.dp.roundToPx()) * (1 - collapse)).roundToInt()
        val height = maxOf(icon.height, textY + text.height)
        val iconY = ((height - icon.height) * collapse / 2).roundToInt()
        layout(width, height) {
            icon.placeRelative(0, iconY)
            text.placeRelative(textX, textY)
        }
    }
}
