package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.ClickableText
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Suppress("DEPRECATION")
@Composable
fun ShareTable(rows: List<List<AnnotatedString>>, header: Boolean, openLink: (AnnotatedString.Range<String>) -> Unit) {
    Column(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).border(1.dp, WebPalette.Border)) {
        rows.forEachIndexed { index, cells ->
            Row(Modifier.background(if (index == 0 && header) WebPalette.Raised
                else if (index % 2 == 0) WebPalette.Surface else WebPalette.Background)) {
                cells.forEach { text ->
                    ClickableText(text, Modifier.width(160.dp).padding(12.dp),
                        style = ShareTypography.body.copy(color = WebPalette.Text,
                            fontWeight = if (index == 0 && header) FontWeight.Bold else FontWeight.Normal)) { offset ->
                        text.getStringAnnotations(offset, offset).firstOrNull()?.let(openLink)
                    }
                }
            }
            HorizontalDivider()
        }
    }
}
