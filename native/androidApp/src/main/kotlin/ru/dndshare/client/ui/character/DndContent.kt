package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun DndAbilities(format: LayoutFormat) {
    if (format != LayoutFormat.Wide) DndFeatureSummary()
    val context = LocalCharacterSheet.current
    val values = context.sheet.values
    val groups =
        listOf(
            "abilities_class" to "Классовые способности",
            "abilities_race" to "Расовые способности",
            "abilities_story" to "Предыстория",
            "abilities_feats" to "Черты",
        )
    groups.forEach { (key, label) ->
        ShareSection(label) {
            val entries = values[key].arrayValue()
            if (entries.isEmpty()) SheetEmpty("Нет записей")
            entries.forEachIndexed { index, entry ->
                val item = context.items[entry.referenceId()]
                SheetCatalogueEntry(
                    entry,
                    editTarget = "ability:$key:$index",
                    extraActions =
                        buildList {
                            if (
                                item?.data?.get("ability_selection")
                                    is kotlinx.serialization.json.JsonObject
                            )
                                add(
                                    ShareMenuAction(
                                        "Выбрать способности",
                                        { context.edit("ability-selection:${item.id}") },
                                    )
                                )
                        },
                    details = {
                        if (item != null) AbilityStatusPanel(key, entry.objectValue(), item)
                    },
                )
            }
            if (context.canEdit) ShareAction("Добавить", { context.edit("ability:$key:new") })
        }
    }
}

@Composable
internal fun DndFeatureSummary() {
    val context = LocalCharacterSheet.current
    FeatureWidgetCards()
    val actions =
        remember(context.sheet, context.items) { featureActions(context.sheet, context.items) }
    if (actions.isEmpty())
        ShareTile(Modifier.fillMaxWidth(), framed = false, contentPadding = PaddingValues(10.dp)) {
            SheetSummaryHeading(
                "Действия",
                if (context.canEdit)
                    listOf(ShareMenuAction("Добавить действие", { context.edit("action:new") }))
                else emptyList(),
            )
            Text("нет", style = ShareTypography.group, color = WebPalette.TextMuted)
        }
    else FeatureActionCards()
    val values = context.sheet.values
    val resources =
        remember(context.sheet.data, context.items) {
            val widgets =
                featureWidgets(context.sheet, context.items).mapNotNull { it.resource?.key }.toSet()
            val actions =
                featureActions(context.sheet, context.items).mapNotNull { it.resource?.key }.toSet()
            val itemPools =
                context.sheet.values["weapon"]
                    .arrayValue()
                    .flatMap { raw ->
                        val uid = raw.objectValue().text("uid")
                        confirmedItemUses(context.sheet, context.items, uid).mapNotNull {
                            it.resource?.key
                        } +
                            weaponUseRules(context.sheet, uid, context.items).mapNotNull {
                                it.resource?.key
                            }
                    }
                    .toSet()
            resourceControls(context.sheet, context.items).filter {
                it.key !in widgets && it.key !in actions && it.key !in itemPools
            }
        }
    val defenses =
        remember(context.sheet.data, context.items) { sheetDefenses(context.sheet, context.items) }
    if (resources.isNotEmpty() || context.canEdit)
        ShareTile(Modifier.fillMaxWidth(), framed = false, contentPadding = PaddingValues(10.dp)) {
            SheetSummaryHeading(
                "Ресурсы",
                if (context.canEdit)
                    buildList {
                        add(ShareMenuAction("Добавить ресурс", { context.edit("resource:new") }))
                        values["resources"].arrayValue().forEachIndexed { index, raw ->
                            add(
                                ShareMenuAction(
                                    "Изменить: ${raw.objectValue().text("title")}",
                                    { context.edit("resource:$index") },
                                )
                            )
                        }
                    }
                else emptyList(),
            )
            if (resources.isEmpty())
                Text("нет", style = ShareTypography.group, color = WebPalette.TextMuted)
            resources.forEach { row ->
                key(row.key) {
                    var error by remember { mutableStateOf<String?>(null) }
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        if (row.total in 1..9) {
                            Text(
                                row.title.uppercase(),
                                style = ShareTypography.group,
                                color = WebPalette.AccentSoft,
                            )
                            ItemResourceOrbs(row, { error = it }, WebPalette.AccentSoft)
                        } else {
                            Row(
                                Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(row.title, Modifier.weight(1f), style = ShareTypography.group)
                                if (context.canEdit)
                                    ShareTextButton(
                                        onClick = { context.adjustResource(row.key, -1) },
                                        modifier = Modifier.width(48.dp),
                                        enabled = row.value > 0,
                                    ) {
                                        Text("−")
                                    }
                                Text(
                                    "${row.value}/${row.total}",
                                    color = WebPalette.AccentSoft,
                                    style = ShareTypography.group,
                                )
                                if (context.canEdit)
                                    ShareTextButton(
                                        onClick = { context.adjustResource(row.key, 1) },
                                        modifier = Modifier.width(48.dp),
                                        enabled = row.value < row.total,
                                    ) {
                                        Text("+")
                                    }
                            }
                        }
                        error?.let {
                            Text(it, style = ShareTypography.context, color = WebPalette.Danger)
                        }
                    }
                }
            }
        }
    if (defenses.isNotEmpty() || context.canEdit)
        ShareTile(Modifier.fillMaxWidth(), framed = false, contentPadding = PaddingValues(10.dp)) {
            SheetSummaryHeading(
                "Защиты",
                if (context.canEdit)
                    buildList {
                        add(ShareMenuAction("Добавить защиту", { context.edit("defense:new") }))
                        values["defenses"].arrayValue().forEachIndexed { index, _ ->
                            add(
                                ShareMenuAction(
                                    "Изменить защиту ${index + 1}",
                                    { context.edit("defense:$index") },
                                )
                            )
                        }
                    }
                else emptyList(),
            )
            if (defenses.isEmpty())
                Text("нет", style = ShareTypography.group, color = WebPalette.TextMuted)
            defenses.forEach { row ->
                val kind =
                    when (row.text("kind")) {
                        "immunity" -> "Невосприимчивость"
                        "vulnerability" -> "Уязвимость"
                        else -> "Сопротивление"
                    }
                val name =
                    context.metadata.suggests["12"]
                        ?.firstOrNull { it.id == row["damage_type"].referenceId() }
                        ?.value
                        .orEmpty()
                Text("$kind · $name", style = ShareTypography.group)
            }
        }
    val groups = values["proficiencies"].objectValue().filterValues { it.arrayValue().isNotEmpty() }
    if (groups.isNotEmpty())
        ShareTile(Modifier.fillMaxWidth(), framed = false, contentPadding = PaddingValues(10.dp)) {
            SheetSummaryHeading(
                "Владения",
                if (context.canEdit)
                    listOf(ShareMenuAction("Изменить владения", { context.edit("proficiencies") }))
                else emptyList(),
            )
            groups.forEach { (label, entries) ->
                Text(
                    "$label: " +
                        entries.arrayValue().joinToString(", ") {
                            it.objectValue().label().ifBlank {
                                (it as? JsonPrimitive)?.content.orEmpty()
                            }
                        },
                    style = ShareTypography.context,
                )
            }
        }
}
