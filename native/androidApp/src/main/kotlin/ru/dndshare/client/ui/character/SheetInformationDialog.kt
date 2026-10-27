package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SheetInformationDialog(target: String, sheet: CharacterSheet, close: () -> Unit,
    back: () -> Unit, refresh: () -> Unit) {
    val context = LocalCharacterSheet.current
    AlertDialog(onDismissRequest = close, title = { Text(if (target == "rest") "Отдых" else sheet.name, style = ShareTypography.section) },
        text = { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (target == "rest") {
                Text("Кости хитов", style = ShareTypography.group)
                val dice = sheet.values["hp"].objectValue()["hitDice"].arrayValue()
                if (dice.isEmpty()) Text("Нет доступных костей", style = ShareTypography.context)
                dice.forEach { value -> val row = value.objectValue(); Text("${row.text("die")}: ${row["total"].number() - row["used"].number()} / ${row["total"].number()}") }
                Text("Короткий отдых позволяет потратить кости хитов. Долгий отдых восстанавливает здоровье и ресурсы по правилам вашей редакции.", style = ShareTypography.context)
            } else {
                Text(listOf(sheet.sourceName, sheet.sourceVersion).filter(String::isNotBlank).joinToString(" · "), style = ShareTypography.group)
                Text(if (sheet.publicVisible) "Публичная ссылка включена" else "Публичная ссылка выключена", style = ShareTypography.context)
                if (context.canEdit) {
                    TextButton(onClick = { close(); context.edit("hp") }) { Text("Здоровье") }
                    TextButton(onClick = { close(); context.edit("statuses") }) { Text("Состояния") }
                }
                TextButton(onClick = { refresh(); close() }) { Text("Обновить лист") }
                TextButton(onClick = { close(); back() }) { Text("К персонажам") }
            }
        } }, confirmButton = { TextButton(onClick = close) { Text("Закрыть") } })
}
