package ru.dndshare.client.ui.character

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.serialization.json.*
import ru.dndshare.client.BuildConfig
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun DndAbilityTile(ability: DndAbility, compact: Boolean) {
    val context = LocalCharacterSheet.current
    val current = LocalSheetEditorPreview.current?.takeIf { it.fields.target == ability.id }
    var retained by remember { mutableStateOf(current) }
    SideEffect { if (current != null) retained = current }
    ShareMorphSource(ability.id, Modifier.fillMaxWidth(), scrollPreview = false) { presentation ->
        val fields = (current ?: retained)?.fields.takeIf { presentation.expanded }
        val value = fields?.number?.toIntOrNull()?.takeIf { it >= 0 }
        val projected =
            remember(context.sheet, fields) {
                if (value == null) context.sheet
                else
                    context.sheet.copy(
                        data =
                            applySheetPatches(
                                context.sheet.data,
                                runCatching { statFormPatches(fields!!, context.sheet) }
                                    .getOrElse {
                                        listOf(context.sheet.manualStatPatch(ability.id, value))
                                    },
                            )
                    )
            }
        val mechanics =
            remember(projected, context.items, context.metadata) {
                DndDerivedValues(projected, context.items, context.metadata)
            }
        CompositionLocalProvider(
            LocalCharacterSheet provides
                context.copy(
                    sheet = projected,
                    canEdit = context.canEdit && !presentation.expanded,
                    mechanics = mechanics,
                )
        ) {
            // Material's layout reservation must not inflate the web's compact rows. Clickable
            // still expands pointer targets to the platform minimum independently of this size.
            CompositionLocalProvider(LocalMinimumInteractiveComponentSize provides 0.dp) {
                DndAbilityFace(ability, compact, presentation)
            }
        }
    }
}

@Composable
private fun DndAbilityFace(
    ability: DndAbility,
    compact: Boolean,
    presentation: ShareMorphPresentation,
) {
    val context = LocalCharacterSheet.current
    val sheet = context.sheet
    val data = sheet.values[ability.id].objectValue()
    val score = context.mechanics.score(ability.id)
    val modifier = abilityModifier(score)
    var saveActions by remember { mutableStateOf(false) }
    var checkActions by remember { mutableStateOf(false) }
    val saveContext = RuleContext(kind = "saving_throw", ability = ability.suggestId)
    val proficient =
        data["save_up"]?.jsonPrimitive?.booleanOrNull == true ||
            context.mechanics.rank("save_proficiency", saveContext) > 0
    val save =
        modifier +
            (if (proficient) sheet.proficiency() else 0) +
            data["save_bonuses"].bonusTotal() +
            context.mechanics.bonus("save_bonus", saveContext)
    val saveRequest = SheetRollRequest(
        "${ability.title} — спасбросок",
        "saving_throw",
        ability.suggestId,
        bonus = save,
        manualMode = data.text("save_roll_mode").ifBlank { "auto" },
        proficiencyRank = if (proficient) 1 else 0,
    )
    val checkRequest = SheetRollRequest(
        "${ability.title} — проверка",
        ability = ability.suggestId,
        bonus = modifier + context.mechanics.bonus(
            "check_bonus",
            RuleContext(kind = "ability_check", ability = ability.suggestId),
        ),
        manualMode = data.text("check_roll_mode").ifBlank { "auto" },
    )
    val skills = (ability.skills.map(Long::toString) + data["skills"].objectValue().keys).distinct()
    val titleSuggest = context.metadata.suggests["16"]?.firstOrNull { it.id == ability.suggestId }
    val color =
        titleSuggest?.color?.let {
            runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull()
        } ?: WebPalette.TextMuted
    // A finite upper bound permits natural full height inside the sheet's scroll container.
    // In the modal the viewport is bounded, so only visible rows are remeasured during reflow.
    val sourceLimit =
        with(androidx.compose.ui.platform.LocalDensity.current) {
            androidx.compose.ui.platform.LocalWindowInfo.current.containerSize.height
                .coerceAtLeast(1)
                .toDp() * (skills.size + 2)
        }
    val valueHeight =
        if (compact) DesignTokens.Layout.SheetValueCompactHeight
        else DesignTokens.Layout.SheetValueHeight
    val valueWidth =
        if (compact) DesignTokens.Layout.SheetValueCompactWidth
        else DesignTokens.Layout.SheetValueWidth
    LazyColumn(
        Modifier.fillMaxWidth()
            .heightIn(max = sourceLimit)
            .clip(RoundedCornerShape(DesignTokens.Radius.Tile))
            .background(WebPalette.Surface)
            .shareAccentStrip(color),
        userScrollEnabled = presentation.expanded,
        contentPadding = PaddingValues(
            top = DesignTokens.Spacing.Small,
            bottom = DesignTokens.Spacing.Medium,
        ),
    ) {
        item("heading") {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = DesignTokens.Spacing.Medium),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(DesignTokens.Spacing.Small),
            ) {
                Text(
                    ability.title.uppercase(),
                    Modifier.weight(1f)
                        .heightIn(min = 24.dp)
                        .wrapContentHeight(Alignment.CenterVertically)
                        .clickable(enabled = context.canEdit) { context.edit(ability.id) }
                        .semantics {
                            if (context.canEdit || presentation.expanded) {
                                contentDescription = "Редактировать: ${ability.title}"
                            }
                        },
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    fontSize = 12.sp,
                    lineHeight = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = WebPalette.TextMuted,
                )
                Surface(
                    onClick = { saveActions = true },
                    modifier =
                        Modifier.semantics {
                            contentDescription = "${ability.title} — спасбросок"
                            if (proficient) stateDescription = "Владение"
                        },
                    enabled = !presentation.expanded,
                    color = WebPalette.Raised.copy(alpha = .6f).compositeOver(WebPalette.Surface),
                    border = if (saveActions) BorderStroke(1.dp, WebPalette.AccentSoft.copy(alpha = .35f)) else null,
                    contentColor = WebPalette.Text,
                    shape = RoundedCornerShape(8.dp),
                ) {
                    Row(
                        Modifier.sizeIn(minWidth = valueWidth + 12.dp, minHeight = valueHeight)
                            .padding(
                                horizontal = 6.dp,
                                vertical = if (compact) 5.dp else 3.dp,
                            ),
                        horizontalArrangement =
                            Arrangement.spacedBy(5.dp, Alignment.CenterHorizontally),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Спас",
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            fontSize = 11.sp,
                            lineHeight = 11.sp,
                            fontWeight = FontWeight.Normal,
                            color = WebPalette.TextMuted,
                        )
                        if (proficient) AbilityProficiencyMarker(rank = 1)
                        Text(
                            signed(save),
                            fontSize = if (compact) 15.sp else 13.sp,
                            lineHeight = if (compact) 15.sp else 13.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        SheetRollModeBadge(context.mechanics, saveRequest)
                    }
                    SheetRollActions(
                        saveActions,
                        { saveActions = false },
                        saveRequest,
                        "skill:${ability.id}:save",
                        dieColor = color,
                    )
                }
            }
        }
        item("score") {
            Row(
                Modifier.fillMaxWidth()
                    .background(if (checkActions) WebPalette.Accent.copy(alpha = .09f) else Color.Transparent)
                    .clickable(enabled = !presentation.expanded) { checkActions = true }
                    .padding(horizontal = DesignTokens.Spacing.Medium),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                titleSuggest?.svg?.takeIf(String::isNotBlank)?.let { svg ->
                    val model =
                        remember(svg) {
                            if (svg.contains("<svg")) svg.toByteArray()
                            else if (svg.startsWith('/')) BuildConfig.API_BASE_URL + svg else svg
                        }
                    AsyncImage(
                        model,
                        null,
                        imageLoader = context.images,
                        colorFilter = ColorFilter.tint(WebPalette.TextSecondary),
                        modifier = Modifier.size(if (compact) 32.dp else 26.dp),
                    )
                }
                Text(
                    signed(checkRequest.bonus),
                    Modifier.alignByBaseline(),
                    style =
                        if (compact) ShareTypography.sheetStatCompact
                        else ShareTypography.sheetStat,
                    color = color,
                )
                Text(
                    "($score)",
                    Modifier.alignByBaseline(),
                    color = WebPalette.TextMuted,
                    fontSize = if (compact) 18.sp else 15.sp,
                )
                SheetRollModeBadge(context.mechanics, checkRequest)
                SheetRollActions(
                    checkActions,
                    { checkActions = false },
                    checkRequest,
                    ability.id,
                    dieColor = color,
                )
            }
        }
        if (skills.isNotEmpty()) {
            item("skill-gap") { Spacer(Modifier.height(DesignTokens.Spacing.Xs)) }
        }
        items(skills, key = { "skill:$it" }) { id ->
            val skill = data["skills"].objectValue()[id].objectValue()
            var skillActions by remember { mutableStateOf(false) }
            val skillContext =
                RuleContext(
                    kind = "skill_check",
                    skill = id.toLongOrNull(),
                    ability = ability.suggestId,
                )
            val rank =
                maxOf(
                    skill["up"].number(),
                    context.mechanics.rank("skill_proficiency", skillContext),
                )
            val title =
                skill.text("override_title").ifBlank {
                    context.metadata.suggests["15"]?.firstOrNull { it.id.toString() == id }?.value
                        ?: skillNames[id.toIntOrNull()]
                        ?: "Навык $id"
                }
            val request = SheetRollRequest(
                "$title — проверка",
                kind = "skill_check",
                ability = ability.suggestId,
                skill = skillContext.skill,
                bonus = modifier + rank * sheet.proficiency() + skill["bonuses"].bonusTotal() +
                    context.mechanics.bonus("skill_bonus", skillContext.copy(proficient = rank > 0)),
                manualMode = skill.text("roll_mode").ifBlank { "auto" },
                proficiencyRank = rank,
            )
            Row(
                Modifier.fillMaxWidth()
                    .padding(horizontal = DesignTokens.Spacing.Medium, vertical = 2.dp)
                    .heightIn(min = valueHeight),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Row(
                    Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(
                        title,
                        Modifier.weight(1f, fill = false),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        fontSize = if (compact) 15.sp else 13.sp,
                        color = WebPalette.Text,
                    )
                    if (rank > 0) AbilityProficiencyMarker(rank)
                }
                SheetRollModeBadge(context.mechanics, request)
                Surface(
                    onClick = { skillActions = true },
                    modifier = Modifier.semantics {
                        if (rank > 0) stateDescription = if (rank >= 2) "Мастерство" else "Владение"
                    },
                    enabled = !presentation.expanded,
                    color = WebPalette.Raised,
                    border = if (skillActions) BorderStroke(1.dp, WebPalette.AccentSoft.copy(alpha = .35f)) else null,
                    contentColor = WebPalette.Text,
                    shape = RoundedCornerShape(if (compact) 9.dp else 7.dp),
                ) {
                    Box(
                        Modifier.sizeIn(minWidth = valueWidth, minHeight = valueHeight)
                            .padding(
                                horizontal = if (compact) 10.dp else 7.dp,
                                vertical = if (compact) 4.dp else 2.dp,
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            signed(request.bonus),
                            fontSize = if (compact) 16.sp else 13.sp,
                            lineHeight = if (compact) 16.sp else 13.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                    SheetRollActions(
                        skillActions,
                        { skillActions = false },
                        request,
                        "skill:${ability.id}:$id",
                        dieColor = color,
                    )
                }
            }
        }
    }
}

@Composable
private fun AbilityProficiencyMarker(rank: Int) {
    Row(horizontalArrangement = Arrangement.spacedBy(DesignTokens.Spacing.Xs)) {
        repeat(rank.coerceAtMost(2)) {
            Box(
                Modifier.size(DesignTokens.Spacing.Compact)
                    .background(WebPalette.TextSecondary, CircleShape)
            )
        }
    }
}

internal val skillNames =
    mapOf(
        1 to "Атлетика",
        2 to "Акробатика",
        3 to "Ловкость рук",
        4 to "Скрытность",
        5 to "Анализ",
        6 to "История",
        7 to "Магия",
        8 to "Природа",
        9 to "Религия",
        10 to "Внимательность",
        11 to "Выживание",
        12 to "Медицина",
        13 to "Проницательность",
        14 to "Уход за животными",
        15 to "Выступление",
        16 to "Запугивание",
        17 to "Обман",
        18 to "Убеждение",
    )
