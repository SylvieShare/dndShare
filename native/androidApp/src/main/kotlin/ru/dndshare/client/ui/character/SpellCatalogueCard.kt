package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*
import ru.dndshare.client.ui.itemStats

@Composable
internal fun SpellCatalogueCard(reference: JsonElement, tab: JsonObject? = null) {
    val context = LocalCharacterSheet.current
    val entry = reference.objectValue()
    val item = context.items[entry.referenceId()]
    val readout =
        remember(context.sheet, context.items, entry) {
            runCatching {
                spellReadout(context.sheet, entry.text("key"), context.items, context.metadata)
            }
                .getOrNull()
        }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val prepared = entry["prepared"] == JsonPrimitive(true)
    val source = entry["source"].objectValue()
    val canPrepare =
        tab?.text("mode") in setOf("prepared", "spellbook") && item?.data?.get("lvl").number() > 0
    val actions = buildList {
        if (canPrepare)
            add(
                ShareMenuAction(
                    if (prepared) "Снять подготовку" else "Подготовить",
                    {
                        busy = true
                        scope.launch {
                            try {
                                error =
                                    context.itemMechanic(
                                        entry.text("key"),
                                        "spell-prepare",
                                        buildJsonObject { put("prepared", !prepared) },
                                    )
                            } finally {
                                busy = false
                            }
                        }
                    },
                    enabled = !busy,
                )
            )
    }
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val inline = maxWidth >= DesignTokens.Layout.Tablet
        val bracket =
            if (prepared) Modifier.sharePreparedBrackets(WebPalette.Accent.copy(alpha = .62f))
            else Modifier
        Box(bracket) {
            SheetCatalogueEntry(
                reference,
                expanded = false,
                editTarget = tab?.let { "spell:${it.text("key")}|${entry.text("key")}" },
                extraActions = actions,
                leading = {
                    val school =
                        context.metadata.suggests["7"]?.firstOrNull {
                            it.id == item?.data?.get("schoolId").referenceId()
                        }
                    val svg = school?.svg
                    val tint =
                        remember(school?.color) {
                            runCatching {
                                    androidx.compose.ui.graphics.Color(
                                        android.graphics.Color.parseColor(school?.color)
                                    )
                                }
                                .getOrDefault(WebPalette.TextMuted)
                        }
                    when {
                        item?.iconImageUrl != null ->
                            AsyncImage(
                                item.iconImageUrl,
                                null,
                                imageLoader = context.images,
                                modifier = Modifier.size(64.dp),
                            )
                        school != null ->
                            AsyncImage(
                                if (!svg.isNullOrBlank())
                                    "data:image/svg+xml;base64," +
                                        android.util.Base64.encodeToString(
                                            svg.toByteArray(),
                                            android.util.Base64.NO_WRAP,
                                        )
                                else "file:///android_asset/character-sheet/tab-magic.svg",
                                null,
                                imageLoader = context.images,
                                colorFilter = androidx.compose.ui.graphics.ColorFilter.tint(tint),
                                modifier = Modifier.size(22.dp),
                            )
                        else -> Spacer(Modifier.width(0.dp))
                    }
                },
                titleStyle = ShareTypography.row,
                titleSuffix = {
                    item?.nameEn?.takeIf(String::isNotBlank)?.let {
                        Text(it, style = ShareTypography.context, color = WebPalette.TextMuted)
                    }
                },
                titleDetails = {
                    val metadata =
                        item
                            ?.let { itemStats(ItemType(5, "Заклинания"), it, context.metadata) }
                            .orEmpty()
                            .filter { it.label in setOf("Время", "Дистанция", "Компоненты") }
                            .map { it.value }
                    if (metadata.isNotEmpty())
                        Text(
                            metadata.joinToString(" · "),
                            style = ShareTypography.context,
                            color = WebPalette.TextSecondary,
                        )
                    source.text("label").takeIf(String::isNotBlank)?.let {
                        Text(
                            it +
                                (if (entry["slotless"] == JsonPrimitive(true)) " · без ячейки"
                                else ""),
                            style = ShareTypography.context,
                            color = WebPalette.TextMuted,
                        )
                    }
                },
                headerActions = { if (inline && readout != null) SpellCardMetrics(readout) },
                contentPadding =
                    PaddingValues(horizontal = if (prepared) 28.dp else 4.dp, vertical = 6.dp),
                showPreparedBadge = false,
                details = {
                    if (!inline && readout != null) SpellCardMetrics(readout)
                    error?.let {
                        Text(it, color = WebPalette.Danger, style = ShareTypography.context)
                    }
                },
            )
        }
    }
}

@Composable
private fun SpellCardMetrics(readout: SpellReadout) {
    val context = LocalCharacterSheet.current
    val key = readout.reference.text("key")
    val options = spellRuleOptions(readout.item)
    val save = spellSavingThrow(readout.item.data["damage"].objectValue(), readout, context.sheet)
    if (
        options.isEmpty() &&
            readout.item.data["damage"].objectValue()["range_attack"] != JsonPrimitive(true) &&
            save == null
    )
        return
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        if (readout.item.data["damage"].objectValue()["range_attack"] == JsonPrimitive(true))
            FilledTonalButton(
                onClick = { context.edit("spell-roll:$key") },
                enabled = context.canEdit,
                modifier =
                    Modifier.heightIn(min = 48.dp).semantics {
                        contentDescription = "Атака заклинанием: ${readout.item.name}"
                    },
            ) {
                Text("Атака ${signed(readout.attack)}")
            }
        for (option in options) {
            val display = option.copy(rule = JsonObject(option.rule - "type_choices"))
            val terms = runCatching {
                spellRollTerms(
                    context.sheet,
                    readout,
                    display,
                    SpellRollOptions(
                        castLevel =
                            readout.reference["cast_level"].number(
                                readout.item.data["lvl"].number()
                            )
                    ),
                    context.items,
                    context.metadata,
                )
            }
                .getOrDefault(emptyList())
            if (terms.isNotEmpty())
                FilledTonalButton(
                    onClick = { context.edit("spell-roll:$key") },
                    enabled = context.canEdit,
                    modifier =
                        Modifier.heightIn(min = 48.dp).semantics {
                            contentDescription = "${option.label}: ${readout.item.name}"
                        },
                ) {
                    Text(terms.joinToString("+") { it.expression }.replace("+-", "-"))
                }
        }
        if (save != null)
            TextButton(onClick = { context.edit("spell-roll:$key") }, enabled = context.canEdit) {
                Text(
                    "Сл ${save["dc"].number()} ${dndAbilities.firstOrNull {it.suggestId==save["ability"].referenceId()}?.title.orEmpty()}"
                )
            }
    }
}
