package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SheetInformationDialog(
    sheet: CharacterSheet,
    remote: SheetRemoteState,
    commands: SheetRemoteController,
    close: () -> Unit,
    back: () -> Unit,
    refresh: () -> Unit,
) {
    val context = LocalCharacterSheet.current
    var confirming by remember { mutableStateOf(false) }
    var edition by remember { mutableStateOf<Edition?>(null) }
    var history by remember { mutableStateOf(false) }
    ShareFormDialog(
        if (history) "История изменений" else sheet.name,
        close,
        dismissEnabled = !remote.busy,
    ) {
        if (remote.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        remote.error?.let { Text(it, color = WebPalette.Danger, style = ShareTypography.context) }
        if (history) {
            if (!remote.historyLoaded && !remote.busy)
                TextButton(onClick = { commands.history() }) { Text("Загрузить историю") }
            if (remote.historyLoaded && remote.history.isEmpty()) SheetEmpty("История пока пуста")
            remote.history.forEach { row ->
                ShareTile(framed = false) {
                    Text(
                        "Версия ${row["version"].number()} · ${relativeCharacterDate(row.text("createdAt"))}",
                        style = ShareTypography.group,
                    )
                    val labels =
                        row["patches"]
                            .arrayValue()
                            .mapNotNull { patch ->
                                val path =
                                    patch.objectValue()["path"].arrayValue().mapNotNull {
                                        (it as? JsonPrimitive)?.content
                                    }
                                path.getOrNull(1)?.let {
                                    fieldLabels[it]
                                        ?: dndAbilities
                                            .firstOrNull { ability -> ability.id == it }
                                            ?.title
                                        ?: "Данные персонажа"
                                }
                            }
                            .distinct()
                    if (labels.isNotEmpty())
                        Text(labels.joinToString(" · "), style = ShareTypography.context)
                    row["metadata"].arrayValue().forEach { raw ->
                        raw.objectValue().text("action").takeIf(String::isNotBlank)?.let {
                            Text(it, style = ShareTypography.context)
                        }
                        (raw.objectValue()["roll"] as? JsonObject)?.let { roll ->
                            Text(
                                roll.text("title") +
                                    " · " +
                                    roll["result"].objectValue()["total"].number(),
                                style = ShareTypography.context,
                            )
                        }
                        raw.objectValue()["events"].arrayValue().forEach { event ->
                            Text(
                                event.objectValue().text("action"),
                                style = ShareTypography.context,
                            )
                        }
                    }
                }
            }
            if (remote.historyLoaded && remote.historyMore)
                TextButton(onClick = { commands.history(more = true) }, enabled = !remote.busy) {
                    Text("Показать ещё")
                }
            TextButton(onClick = { history = false }) { Text("К меню персонажа") }
        } else {
            Text(
                listOf(sheet.sourceName, sheet.sourceVersion)
                    .filter(String::isNotBlank)
                    .joinToString(" · "),
                style = ShareTypography.group,
            )
            if (context.canEdit) {
                Row {
                    TextButton(
                        onClick = { context.history(false) },
                        enabled = context.canUndo && !remote.busy,
                    ) {
                        Text("Отменить изменение")
                    }
                    TextButton(
                        onClick = { context.history(true) },
                        enabled = context.canRedo && !remote.busy,
                    ) {
                        Text("Повторить изменение")
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Публичная ссылка", Modifier.weight(1f), style = ShareTypography.group)
                    Switch(sheet.publicVisible, commands::visibility, enabled = !remote.busy)
                }
                TextButton(
                    onClick = {
                        close()
                        context.edit("portrait")
                    }
                ) {
                    Text("Портрет")
                }
                TextButton(
                    onClick = {
                        close()
                        context.edit("icon")
                    }
                ) {
                    Text("Иконка")
                }
                TextButton(
                    onClick = {
                        close()
                        context.edit("identity")
                    }
                ) {
                    Text("Имя персонажа")
                }
                TextButton(
                    onClick = {
                        close()
                        context.edit("statuses")
                    }
                ) {
                    Text("Состояния и вдохновение")
                }
                if (sheet.templateName == "DND5") {
                    TextButton(
                        onClick = {
                            close()
                            context.edit("sources")
                        }
                    ) {
                        Text("Источники контента")
                    }
                    TextButton(
                        onClick = {
                            close()
                            context.edit("proficiencies")
                        }
                    ) {
                        Text("Владения")
                    }
                    val editions =
                        commands.sources.firstOrNull { it.id == sheet.sourceId }?.versions.orEmpty()
                    if (editions.size > 1) {
                        Text("Редакция правил", style = ShareTypography.group)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            editions.forEach { version ->
                                FilterChip(
                                    version.id == sheet.sourceVersionId,
                                    onClick = {
                                        if (version.id != sheet.sourceVersionId) edition = version
                                    },
                                    enabled = !remote.busy,
                                    label = { Text(version.version) },
                                )
                            }
                        }
                    }
                }
                TextButton(
                    onClick = {
                        history = true
                        commands.history()
                    },
                    enabled = !remote.busy,
                ) {
                    Text("История изменений")
                }
            }
            CharacterExportActions()
            TextButton(onClick = commands::clone, enabled = !remote.busy) {
                Text("Клонировать персонажа")
            }
            TextButton(
                onClick = {
                    refresh()
                    close()
                },
                enabled = !remote.busy,
            ) {
                Text("Обновить лист")
            }
            TextButton(
                onClick = {
                    close()
                    back()
                },
                enabled = !remote.busy,
            ) {
                Text("К персонажам")
            }
            if (context.canEdit)
                TextButton(onClick = { confirming = true }, enabled = !remote.busy) {
                    Text("Удалить персонажа", color = WebPalette.Danger)
                }
        }
    }
    if (confirming)
        AlertDialog(
            onDismissRequest = { confirming = false },
            title = { Text("Удалить персонажа?") },
            text = { Text(sheet.name) },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirming = false
                        commands.delete()
                    }
                ) {
                    Text("Удалить", color = WebPalette.Danger)
                }
            },
            dismissButton = { TextButton(onClick = { confirming = false }) { Text("Отмена") } },
        )
    edition?.let { selected ->
        AlertDialog(
            onDismissRequest = { edition = null },
            title = { Text("Переключить редакцию на ${selected.version}?") },
            text = {
                Text(
                    "Расчёты и доступные варианты будут использовать новую редакцию. Содержимое персонажа автоматически не преобразуется."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        edition = null
                        commands.edition(selected.id)
                    }
                ) {
                    Text("Переключить")
                }
            },
            dismissButton = { TextButton(onClick = { edition = null }) { Text("Отмена") } },
        )
    }
}

private val fieldLabels =
    mapOf(
        "name" to "Имя",
        "hp" to "Здоровье",
        "weapon" to "Оружие",
        "spells" to "Заклинания",
        "items" to "Инвентарь",
        "money" to "Кошелёк",
        "lvl" to "Уровень",
        "states" to "Состояния",
        "notes" to "Заметки",
        "abilities_class" to "Классовые способности",
        "abilities_race" to "Расовые способности",
        "abilities_feats" to "Черты",
    )
