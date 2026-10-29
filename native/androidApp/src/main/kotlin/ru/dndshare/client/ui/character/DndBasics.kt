package ru.dndshare.client.ui.character

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun DndStats(adaptive: Boolean = true) {
    val context = LocalCharacterSheet.current
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val columns =
            if (adaptive)
                ((maxWidth + 12.dp) / (DesignTokens.Layout.SheetStatMin + 12.dp))
                    .toInt()
                    .coerceIn(1, 3)
            else 1
        val weights = dndAbilities.map { ability ->
            116 +
                (ability.skills.map(Long::toString) +
                        context.sheet.values[ability.id].objectValue()["skills"].objectValue().keys)
                    .distinct()
                    .size * 34
        }
        ShareBalancedColumns(
            minimumWidth = if (adaptive) DesignTokens.Layout.SheetStatMin else 10_000.dp
        ) {
            statColumnOrder(weights, columns).forEach { index ->
                key(dndAbilities[index].id) { DndAbilityTile(dndAbilities[index], adaptive) }
            }
        }
    }
}

@Composable
internal fun DndIdentityCard(compactHealth: Boolean = false) {
    val context = LocalCharacterSheet.current
    val sheet = context.sheet
    ShareTile(
        framed = false,
        contentPadding = PaddingValues(0.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            Column(Modifier.width(110.dp)) {
                val icon = sheet.iconImageUrl
                Box(Modifier.width(110.dp).height(113.dp).padding(start = 15.dp, top = 15.dp)) {
                    Box(
                        Modifier.size(88.dp).clip(RoundedCornerShape(18.dp)).clickable(
                            enabled = context.canEdit
                        ) {
                            context.edit("icon")
                        },
                        contentAlignment = Alignment.Center,
                    ) {
                        if (icon != null)
                            AsyncImage(
                                icon,
                                "Иконка персонажа",
                                imageLoader = context.images,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize(),
                            )
                        else
                            Text(
                                sheet.name.take(1),
                                style = ShareTypography.title,
                                color = WebPalette.AccentSoft,
                            )
                    }
                }
                Box(Modifier.fillMaxWidth().padding(start = 15.dp, end = 6.dp, bottom = 15.dp)) {
                    ShareDashedAction(
                        "+ Состояние",
                        { context.edit("statuses") },
                        compact = true,
                        enabled = context.canEdit,
                        textStyle =
                            ShareTypography.context.copy(fontSize = 10.sp, lineHeight = 14.sp),
                    )
                }
            }
            Column(
                Modifier.weight(1f).padding(15.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(0.dp)) {
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Text(
                            sheet.name,
                            Modifier.clickable(enabled = context.canEdit) {
                                context.edit("identity")
                            },
                            fontSize = 26.sp,
                            lineHeight = 28.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            sheet.values["subrace"].objectValue().label().ifBlank {
                                sheet.values["race"].objectValue().label()
                            },
                            fontSize = 14.sp,
                            lineHeight = 18.sp,
                            color = WebPalette.TextSecondary,
                        )
                    }
                    Text(
                        sheet.values["classes"].arrayValue().joinToString(" · ") {
                            val row = it.objectValue()
                            "${row.label()} ${row["level"].number()}" +
                                row["subclass"]
                                    .objectValue()
                                    .label()
                                    .takeIf(String::isNotBlank)
                                    ?.let { " ($it)" }
                                    .orEmpty()
                        },
                        fontSize = 14.sp,
                        lineHeight = 18.sp,
                        color = WebPalette.TextSecondary,
                    )
                }
                DndHealth(compact = compactHealth)
            }
        }
        DndStatuses()
    }
}

@Composable
internal fun DndHealth(compact: Boolean = false) {
    val dying =
        LocalCharacterSheet.current.sheet.values["hp"].objectValue()["current"].number() <= 0
    if (compact) DndHealthFace(true)
    else
        Crossfade(
            dying,
            Modifier.fillMaxWidth(),
            tween(DesignTokens.Motion.Feedback),
            label = "Health state",
        ) { dead ->
            if (dead) DndDeathSaves() else DndHealthFace(false)
        }
}

@Composable
private fun DndHealthFace(compact: Boolean) {
    val context = LocalCharacterSheet.current
    val sheet = context.sheet
    val hp = sheet.values["hp"].objectValue()
    val maximum = context.mechanics.hpMaximum()
    val current = hp["current"].number()
    val percent = if (maximum > 0) (current.toFloat() / maximum).coerceIn(0f, 1f) else 0f
    val color =
        if (percent > .6f) WebPalette.Success
        else if (percent > .25f) WebPalette.Warning else WebPalette.Danger
    val numbers: @Composable () -> Unit = {
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            AsyncImage(
                "file:///android_asset/character-sheet/hp-pulse.svg",
                null,
                imageLoader = context.images,
                colorFilter = ColorFilter.tint(color),
                modifier =
                    Modifier.size(if (compact) 20.dp else 26.dp).align(Alignment.CenterVertically),
            )
            Text(
                current.toString(),
                Modifier.align(Alignment.CenterVertically),
                fontSize = if (compact) 22.sp else 36.sp,
                lineHeight = if (compact) 24.sp else 36.sp,
                fontWeight = FontWeight.ExtraBold,
                color = color,
            )
            Text(
                "/ $maximum",
                Modifier.align(Alignment.CenterVertically),
                fontSize = if (compact) 16.sp else 22.sp,
                fontWeight = FontWeight.Bold,
                color = WebPalette.TextSecondary,
            )
            if (hp["temp"].number() > 0)
                Text(
                    "+${hp["temp"].number()}",
                    Modifier.align(Alignment.CenterVertically),
                    color = WebPalette.Info,
                    fontSize = if (compact) 13.sp else 18.sp,
                )
        }
    }
    val temp =
        if (maximum > 0) (hp["temp"].number().toFloat() / maximum).coerceIn(0f, 1f - percent)
        else 0f
    val click = Modifier.clickable(enabled = context.canEdit) { context.edit("hp") }
    if (compact)
        Column(
            Modifier.widthIn(min = 96.dp).width(IntrinsicSize.Max).then(click),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            numbers()
            HpBar(percent, temp, color, Modifier.fillMaxWidth(), 4.dp)
        }
    else
        FlowRow(
            Modifier.fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(color.copy(alpha = .055f))
                .then(click)
                .padding(horizontal = 16.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.spacedBy(18.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(Modifier.align(Alignment.CenterVertically)) { numbers() }
            HpBar(
                percent,
                temp,
                color,
                Modifier.weight(1f).widthIn(min = 120.dp).align(Alignment.CenterVertically),
                22.dp,
            )
        }
}

@Composable
internal fun DndStatuses(showEmpty: Boolean = false) {
    val context = LocalCharacterSheet.current
    val values = context.sheet.values
    if (
        !showEmpty &&
            values["states"].arrayValue().isEmpty() &&
            values["exhaustion"].objectValue()["level"].number() == 0 &&
            values["inspiration"] != JsonPrimitive(true)
    )
        return
    Row(
        Modifier.fillMaxWidth()
            .clickable(enabled = context.canEdit) { context.edit("statuses") }
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text("Состояния", style = ShareTypography.context, color = WebPalette.TextSecondary)
        val states = values["states"].arrayValue()
        if (states.isEmpty() && !showEmpty)
            Text("Нет состояний", style = ShareTypography.context, color = WebPalette.TextMuted)
        else
            Text(
                states.joinToString(" · ") { entry ->
                    val data = entry.objectValue()
                    context.items[data["effect_id"].referenceId()]?.name
                        ?: data.label().ifBlank { "Состояние" }
                },
                style = ShareTypography.context,
                color = WebPalette.AccentSoft,
            )
        if (values["inspiration"]?.jsonPrimitive?.booleanOrNull == true)
            Text("Вдохновение", style = ShareTypography.context, color = WebPalette.AccentSoft)
        if (values["exhaustion"].objectValue()["level"].number() > 0)
            Text(
                "Истощение ${values["exhaustion"].objectValue()["level"].number()}",
                style = ShareTypography.context,
                color = WebPalette.Warning,
            )
    }
}

@Composable
private fun HpBar(
    percent: Float,
    temporary: Float,
    color: Color,
    modifier: Modifier,
    height: androidx.compose.ui.unit.Dp,
) {
    val animated by animateFloatAsState(percent, tween(DesignTokens.Motion.Feedback), label = "HP")
    val animatedTemp by
        animateFloatAsState(temporary, tween(DesignTokens.Motion.Feedback), label = "Temporary HP")
    Canvas(
        modifier
            .height(height)
            .clip(RoundedCornerShape(height / 2))
            .background(WebPalette.Background)
    ) {
        val filled = animated.coerceIn(0f, 1f)
        drawRect(color, size = Size(size.width * filled, size.height))
        val extra = animatedTemp.coerceIn(0f, 1f - filled)
        if (extra > 0f)
            drawRect(
                WebPalette.Info,
                topLeft = Offset(size.width * filled, 0f),
                size = Size(size.width * extra, size.height),
            )
    }
}
