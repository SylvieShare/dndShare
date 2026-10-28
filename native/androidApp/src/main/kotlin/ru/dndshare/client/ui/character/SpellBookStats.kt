package ru.dndshare.client.ui.character

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SpellBookStats(source: JsonObject) {
    val context = LocalCharacterSheet.current
    val ability = source["casting_ability"].referenceId()?.takeIf { it in 1..6 }
    val compact = LocalWindowInfo.current.containerDpSize.width < DesignTokens.Layout.Tablet
    val stat = dndAbilities.firstOrNull { it.suggestId == ability }
    val modifier = stat?.let { abilityModifier(context.mechanics.score(it.id)) } ?: 0
    val rows =
        listOf(
            Triple("Базовая хар-ка", stat?.title ?: "—", WebPalette.Accent),
            Triple(
                "СЛ спасброска",
                (8 + context.sheet.proficiency() + modifier + source["save_bonus"].number())
                    .toString(),
                WebPalette.Info,
            ),
            Triple(
                "Атака закл.",
                signed(context.sheet.proficiency() + modifier + source["attack_bonus"].number()),
                WebPalette.AccentSoft,
            ),
        )
    ShareTile(
        Modifier.fillMaxWidth(),
        framed = false,
        contentPadding = PaddingValues(if (compact) 14.dp else 18.dp),
    ) {
        SpellPanelHeading(
            "Параметры магии · " + source.text("name"),
            "Настроить книгу",
            if (context.canEdit) ({ context.edit("spell-tab:" + source.text("key")) }) else null,
        )
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(if (compact) 0.dp else 10.dp),
        ) {
            rows.forEachIndexed { index, (label, value, accent) ->
                if (compact && index > 0)
                    VerticalDivider(Modifier.height(76.dp), color = WebPalette.Border)
                Column(
                    Modifier.weight(1f)
                        .background(
                            if (compact) Color.Transparent else WebPalette.Background,
                            RoundedCornerShape(8.dp),
                        )
                        .padding(
                            horizontal = if (compact) 10.dp else 13.dp,
                            vertical = if (compact) 6.dp else 12.dp,
                        ),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        label.uppercase(),
                        Modifier.heightIn(min = if (compact) 22.dp else 14.dp),
                        style =
                            ShareTypography.context.copy(
                                fontSize = if (compact) 9.sp else 11.sp,
                                fontWeight = FontWeight.Bold,
                                lineHeight = if (compact) 11.sp else 13.sp,
                                letterSpacing = .5.sp,
                            ),
                        color = WebPalette.TextMuted,
                    )
                    Text(
                        value,
                        maxLines = 1,
                        style =
                            ShareTypography.group.copy(
                                fontSize =
                                    if (index == 0) (if (compact) 16.sp else 18.sp)
                                    else (if (compact) 23.sp else 26.sp),
                                lineHeight = 28.sp,
                                fontWeight = FontWeight.Bold,
                            ),
                    )
                    Box(
                        (if (compact) Modifier.width(28.dp) else Modifier.fillMaxWidth())
                            .height(3.dp)
                            .background(accent, RoundedCornerShape(3.dp))
                    )
                }
            }
        }
    }
}
