package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun FeatureActionCards() {
    val context = LocalCharacterSheet.current
    val actions =
        remember(context.sheet, context.items) { featureActions(context.sheet, context.items) }
    var target by remember { mutableStateOf<FeatureAction?>(null) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    fun perform(action: FeatureAction, input: JsonObject) {
        if (busy) return
        busy = true
        scope.launch {
            try {
                error = context.itemMechanic(action.key, "feature-action", input)
                if (error == null) target = null
            } finally {
                busy = false
            }
        }
    }
    for ((type, title) in featureActionTypes) {
        val group = actions.filter { it.type == type }
        if (group.isEmpty()) continue
        ShareTile(Modifier.fillMaxWidth(), framed = false) {
            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                Text(title, Modifier.weight(1f), style = ShareTypography.card)
                if (context.canEdit && group.size > 1)
                    ShareActionMenu(
                        "Порядок: $title",
                        listOf(
                            ShareMenuAction(
                                "Изменить порядок",
                                Glyph.Move,
                                { context.edit("reorder:actions|$type") },
                            )
                        ),
                    )
            }
            group.forEach { action ->
                Row {
                    Text(action.title, Modifier.weight(1f), style = ShareTypography.group)
                    if (context.canEdit)
                        ShareActionMenu(
                            "Действия: ${action.title}",
                            buildList {
                                action.manualIndex?.let {
                                    add(
                                        ShareMenuAction(
                                            "Изменить",
                                            Glyph.Edit,
                                            { context.edit("action:$it") },
                                        )
                                    )
                                }
                                action.definition["menu_effects"].arrayValue().forEachIndexed {
                                    index,
                                    raw ->
                                    val effect = raw.objectValue()
                                    if (effect.text("kind") == "adjust_counter")
                                        add(
                                            ShareMenuAction(
                                                effect.text("title").ifBlank {
                                                    "Применить последствие"
                                                },
                                                Glyph.Wand,
                                                {
                                                    perform(
                                                        action,
                                                        buildJsonObject {
                                                            put("operation", "effect")
                                                            put(
                                                                "effectKey",
                                                                effect.text("key").ifBlank {
                                                                    "${effect.text("value_id")}:${effect.text("counter_key")}:$index"
                                                                },
                                                            )
                                                        },
                                                    )
                                                },
                                            )
                                        )
                                }
                                action.feature?.let {
                                    add(
                                        ShareMenuAction(
                                            "Справочник",
                                            Glyph.Book,
                                            { context.openItem(it.item.id) },
                                        )
                                    )
                                }
                            },
                        )
                }
                action.feature?.item?.name?.let {
                    Text(it, style = ShareTypography.context, color = WebPalette.TextMuted)
                }
                if (action.description.isNotBlank()) SheetDescription(action.description)
                val time = action.definition["time"].objectValue()
                if (time.isNotEmpty())
                    Text(
                        if (time.text("kind") == "custom") time.text("text")
                        else
                            "${time["value"].number()} ${mapOf("rounds" to "раунд.","minutes" to "мин.","hours" to "ч.","days" to "дн.")[time.text("kind")].orEmpty()}",
                        style = ShareTypography.context,
                    )
                action.definition["requirements"]
                    .arrayValue()
                    .map { it.jsonPrimitive.content }
                    .filter(String::isNotBlank)
                    .forEach { Text("• $it", style = ShareTypography.context) }
                action.resource?.let { resource ->
                    Row {
                        Text(
                            "${resource.title}: ${resource.value}/${resource.total}",
                            Modifier.weight(1f),
                            style = ShareTypography.group,
                        )
                        if (context.canEdit) {
                            ShareTextButton(
                                onClick = { context.adjustResource(resource.key, -1) },
                                enabled = !busy && resource.value > 0,
                            ) {
                                Text("−")
                            }
                            ShareTextButton(
                                onClick = { context.adjustResource(resource.key, 1) },
                                enabled = !busy && resource.value < resource.total,
                            ) {
                                Text("+")
                            }
                        }
                    }
                }
                if (
                    action.definition.text("target_kind") == "weapon" &&
                        action.definition.text("status_effect_code").isNotBlank()
                ) {
                    val cost = action.definition["resource_cost"].number().coerceAtLeast(0)
                    ShareAction(
                        "Выбрать оружие" + if (cost > 0) " · $cost использ." else "",
                        { target = action },
                        enabled =
                            context.canEdit &&
                                !busy &&
                                (cost == 0 || (action.resource?.value ?: 0) >= cost),
                    )
                }
            }
        }
    }
    if (context.canEdit)
        ShareTextButton(onClick = { context.edit("action:new") }) { Text("Добавить действие") }
    error?.let { Text(it, color = WebPalette.Danger) }
    target?.let { action ->
        ShareFormDialog(action.title, { if (!busy) target = null }, dismissEnabled = !busy) {
            val weapons = context.sheet.values["weapon"].arrayValue().map { it.objectValue() }
            if (weapons.isEmpty()) Text("У персонажа нет оружия.")
            weapons.forEach { entry ->
                ShareAction(
                    resolveWeapon(entry, context.items)?.name ?: "Оружие",
                    {
                        perform(
                            action,
                            buildJsonObject {
                                put("operation", "target")
                                put("targetUid", entry.text("uid"))
                            },
                        )
                    },
                    enabled = !busy,
                )
            }
            error?.let { Text(it, color = WebPalette.Danger) }
        }
    }
}
