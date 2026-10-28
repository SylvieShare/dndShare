package ru.dndshare.client.ui.character

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SpellSourceTabs(tabs: List<JsonObject>, selected: String?, select: (String) -> Unit) {
    val context = LocalCharacterSheet.current
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            for (tab in tabs) {
                val active = tab.text("key") == selected
                val shape = RoundedCornerShape(50)
                Text(
                    tab.text("name").ifBlank { "Магия" },
                    Modifier.border(
                            1.dp,
                            if (active) WebPalette.Accent else WebPalette.Border,
                            shape,
                        )
                        .background(
                            if (active) WebPalette.Accent.copy(alpha = .1f) else Color.Transparent,
                            shape,
                        )
                        .selectable(selected = active, role = Role.Tab) { select(tab.text("key")) }
                        .padding(horizontal = 10.dp, vertical = 5.dp),
                    style =
                        ShareTypography.context.copy(
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Normal,
                        ),
                    color = if (active) WebPalette.Text else WebPalette.TextMuted,
                )
            }
            if (context.canEdit)
                Text(
                    "+ Вкладка",
                    Modifier.border(1.dp, WebPalette.Border, RoundedCornerShape(50))
                        .clickable(role = Role.Button) { context.edit("spell-tab:new") }
                        .padding(horizontal = 10.dp, vertical = 5.dp),
                    style =
                        ShareTypography.context.copy(
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Normal,
                        ),
                    color = WebPalette.TextMuted,
                )
        }
        if (context.canEdit && tabs.size > 1)
            ShareTextButton(onClick = { context.edit("reorder:spell-tabs") }) {
                Text("Порядок книг")
            }
        HorizontalDivider(color = WebPalette.Border)
    }
}

@Composable
internal fun SpellPreparationSummary(count: Int, limit: Int?, entries: List<JsonElement>) {
    val context = LocalCharacterSheet.current
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            "Подготовлено: " + count + (limit?.let { " / " + it }.orEmpty()),
            Modifier.background(WebPalette.Accent.copy(alpha = .14f), RoundedCornerShape(8.dp))
                .padding(horizontal = 11.dp, vertical = 5.dp),
            style = ShareTypography.context.copy(fontSize = 13.sp, fontWeight = FontWeight.Bold),
            color = WebPalette.AccentSoft,
        )
        val groups =
            entries
                .filter { it.objectValue()["prepared"] == JsonPrimitive(true) }
                .groupBy { context.items[it.referenceId()]?.data?.get("lvl").number() }
        groups.toSortedMap().forEach { (level, rows) ->
            Text(
                (if (level == 0) "Заговоры" else "$level круг") + " · " + rows.size,
                Modifier.background(WebPalette.Text.copy(alpha = .05f), RoundedCornerShape(8.dp))
                    .padding(horizontal = 10.dp, vertical = 5.dp),
                style =
                    ShareTypography.context.copy(fontSize = 12.sp, fontWeight = FontWeight.Bold),
                color = WebPalette.TextSecondary,
            )
        }
    }
}
