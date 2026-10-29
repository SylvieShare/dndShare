package ru.dndshare.client.ui.character

import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun InventorySectionHeading(
    section: JsonObject,
    model: JsonObject,
    busy: Boolean,
    remove: (String) -> Unit,
) {
    val context = LocalCharacterSheet.current
    val id = section.text("id")
    val name = section.text("name")
    Row(
        Modifier.fillMaxWidth().heightIn(min = 24.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        ShareActionMenu(
            "Настройки: $name",
            buildList {
                if (context.canEdit) {
                    add(
                        ShareMenuAction(
                            "Переименовать",
                            Glyph.Edit,
                            { context.edit("inventory-section:$id") },
                            !busy,
                        )
                    )
                    if (inventorySpaceEntries(model, id).size > 1)
                        add(
                            ShareMenuAction(
                                "Изменить порядок",
                                Glyph.Move,
                                { context.edit("reorder:inventory|$id") },
                                !busy,
                            )
                        )
                    if (model["sections"].arrayValue().size > 1)
                        add(
                            ShareMenuAction(
                                "Удалить секцию",
                                Glyph.Trash,
                                { remove(id) },
                                !busy,
                                danger = true,
                            )
                        )
                }
            },
            trigger = { modifier, open ->
                Text(
                    name.uppercase(Locale.forLanguageTag("ru-RU")),
                    modifier.combinedClickable(
                        enabled = context.canEdit && !busy,
                        onClick = { context.edit("inventory-section:$id") },
                        onLongClick = open,
                    ),
                    style =
                        ShareTypography.context.copy(
                            fontSize = 12.sp,
                            lineHeight = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = .96.sp,
                        ),
                    color = WebPalette.TextMuted,
                )
            },
        )
        HorizontalDivider(Modifier.weight(1f), color = WebPalette.TextMuted.copy(alpha = .42f))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            AppGlyph(Glyph.Weight, Modifier.size(14.dp), WebPalette.TextMuted)
            val weight =
                DecimalFormat("0.########", DecimalFormatSymbols(Locale.forLanguageTag("ru-RU")))
                    .format(inventoryEntriesWeight(inventorySpaceEntries(model, id), context.items))
            Text(
                "$weight фунт.",
                style = ShareTypography.context.copy(fontSize = 12.sp),
                color = WebPalette.TextMuted,
            )
        }
        if (context.canEdit && model["sections"].arrayValue().size > 1)
            IconButton(
                onClick = { remove(id) },
                enabled = !busy,
                modifier =
                    Modifier.size(24.dp).semantics { contentDescription = "Удалить секцию: $name" },
            ) {
                AppGlyph(Glyph.Trash, Modifier.size(14.dp), WebPalette.TextMuted)
            }
    }
}
