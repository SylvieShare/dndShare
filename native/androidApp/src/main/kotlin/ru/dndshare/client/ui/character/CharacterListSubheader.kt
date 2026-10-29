package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun CharacterListSubheader(create: () -> Unit) {
    ShareSubheader(maxContentWidth = DesignTokens.Layout.ContentMax) {
        FlowRow(
            Modifier.fillMaxWidth().heightIn(min = 48.dp).padding(horizontal = 16.dp),
            itemVerticalAlignment = Alignment.CenterVertically,
            verticalArrangement = Arrangement.spacedBy(8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                "Персонажи",
                Modifier.semantics { heading() },
                style =
                    ShareTypography.header.copy(
                        fontSize = 22.sp,
                        lineHeight = 28.sp,
                        fontWeight = FontWeight.Bold,
                    ),
            )
            ShareButton(
                onClick = create,
                modifier =
                    Modifier.heightIn(min = 34.dp).semantics {
                        contentDescription = "Новый персонаж"
                    },
                contentPadding = PaddingValues(horizontal = 13.dp, vertical = 6.dp),
            ) {
                Text("+", fontSize = 18.sp)
                Spacer(Modifier.width(7.dp))
                Text("Новый персонаж", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
