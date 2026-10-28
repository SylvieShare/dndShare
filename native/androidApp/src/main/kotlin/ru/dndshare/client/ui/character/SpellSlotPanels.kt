package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SpellSlotPanels() {
    val context = LocalCharacterSheet.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val pools =
        listOf("long_rest", "short_rest")
            .map { pool ->
                pool to
                    context.sheet.values["spells"]
                        .objectValue()["slot_pools"]
                        .objectValue()[pool]
                        .arrayValue()
                        .map { it.objectValue() }
                        .filter { it["total"].number() > 0 }
            }
            .filter { it.second.isNotEmpty() }
    if (pools.isEmpty() && !context.canEdit) return
    fun set(pool: String, level: Int, used: Int) {
        if (busy) return
        busy = true
        scope.launch {
            try {
                error =
                    context.itemMechanic(
                        pool,
                        "spell-slot",
                        buildJsonObject {
                            put("level", level)
                            put("used", used)
                        },
                    )
            } finally {
                busy = false
            }
        }
    }
    ShareTile(Modifier.fillMaxWidth(), framed = false, contentPadding = PaddingValues(14.dp)) {
        SpellPanelHeading(
            "Ячейки заклинаний",
            "Настроить ячейки",
            if (context.canEdit) ({ context.edit("spell-slots") }) else null,
        )
        pools.forEach { (pool, rows) ->
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    if (pool == "short_rest") "Короткий отдых" else "Долгий отдых",
                    style =
                        ShareTypography.context.copy(
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                        ),
                )
                Text(
                    if (pool == "short_rest") "также после долгого"
                    else "восстанавливаются после долгого",
                    style =
                        ShareTypography.context.copy(
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Normal,
                        ),
                    color = WebPalette.TextMuted,
                )
            }
            rows.forEach { slot ->
                val level = slot["level"].number()
                val used = slot["used"].number()
                val total = slot["total"].number()
                Row(
                    Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Column(Modifier.width(40.dp), horizontalAlignment = Alignment.End) {
                        Text(
                            level.toString(),
                            style = ShareTypography.group.copy(fontSize = 18.sp),
                            color = WebPalette.TextSecondary,
                        )
                        Text(
                            "КРУГ",
                            style =
                                ShareTypography.context.copy(
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = .7.sp,
                                ),
                            color = WebPalette.TextMuted,
                        )
                    }
                    if (total <= 100)
                        FlowRow(Modifier.weight(1f)) {
                            for (pip in total downTo 1) ShareResourceOrb(
                                pip > used,
                                "Ячейка " + level + " круга · " + pip,
                                enabled = context.canEdit && !busy,
                                onClick = { set(pool, level, if (pip <= used) pip - 1 else pip) },
                            )
                        }
                    else
                        FlowRow(Modifier.weight(1f)) {
                            Text(
                                (total - used).toString() + " / " + total,
                                style = ShareTypography.group,
                            )
                            TextButton(
                                { set(pool, level, used - 1) },
                                enabled = context.canEdit && !busy && used > 0,
                            ) {
                                Text("Восстановить")
                            }
                            TextButton(
                                { set(pool, level, used + 1) },
                                enabled = context.canEdit && !busy && used < total,
                            ) {
                                Text("Потратить")
                            }
                        }
                }
            }
        }
        error?.let { Text(it, color = WebPalette.Danger, style = ShareTypography.context) }
    }
}
