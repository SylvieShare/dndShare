package ru.dndshare.client.ui.character

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SheetRollResultView(result: SheetRollResult?, threshold: Int = 20) {
    var expanded by remember(result) { mutableStateOf(false) }
    AnimatedContent(result, label = "Dice result") { current ->
        if (current == null)
            Box(Modifier.fillMaxWidth().height(100.dp), contentAlignment = Alignment.Center) {
                Text("d20", fontSize = 48.sp, color = WebPalette.TextMuted)
            }
        else
            Column(
                Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                val color =
                    when {
                        current.selected == null -> WebPalette.AccentSoft
                        current.selected >= threshold -> WebPalette.Success
                        current.selected == 1 && current.adjustments.isEmpty() -> WebPalette.Danger
                        else -> WebPalette.AccentSoft
                    }
                Text(
                    current.total.toString(),
                    fontSize = if (current.total.toString().length > 8) 48.sp else 64.sp,
                    color = color,
                )
                if (current.rolls.isNotEmpty())
                    Text(
                        (if (expanded) current.rolls else current.rolls.take(50)).joinToString(
                            " · "
                        ) +
                            (if (!expanded && current.rolls.size > 50)
                                " · ещё ${current.rolls.size-50}"
                            else "") +
                            (if (current.selected != null) " ${signed(current.bonus)}" else ""),
                        style = ShareTypography.group,
                    )
                if (current.rolls.size > 50)
                    ShareTextButton(onClick = { expanded = !expanded }) {
                        Text(if (expanded) "Свернуть кости" else "Показать все кости")
                    }
                if (current.bonusDice.isNotEmpty())
                    Text(
                        "Дополнительные кости: ${current.bonusDice.joinToString(" · ")}",
                        style = ShareTypography.context,
                    )
                current.byType
                    .filter { it.text("label").isNotBlank() }
                    .forEach { row ->
                        val tint =
                            remember(row.text("color")) {
                                runCatching {
                                        Color(android.graphics.Color.parseColor(row.text("color")))
                                    }
                                    .getOrDefault(WebPalette.AccentSoft)
                            }
                        Text(
                            "${row.text("label")}: ${row["value"].number()}",
                            color = tint,
                            style = ShareTypography.group,
                        )
                    }
                current.sources.forEach {
                    Text(it, style = ShareTypography.context, color = WebPalette.TextSecondary)
                }
            }
    }
}
