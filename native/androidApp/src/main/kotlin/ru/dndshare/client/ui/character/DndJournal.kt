package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.WireJson
import ru.dndshare.client.model.text
import ru.dndshare.designsystem.*

@Composable
internal fun DndJournal() {
    val context = LocalCharacterSheet.current
    val payload by remember(context.uuid, context.repository) {
        context.repository.database.characterSheets().observeSection(context.uuid, "journal")
    }.collectAsState(null)
    var error by remember(context.uuid) { mutableStateOf<String?>(null) }
    var loading by remember(context.uuid) { mutableStateOf(true) }
    LaunchedEffect(context.uuid) {
        try { context.repository.refreshCharacterJournal(context.uuid) }
        catch (cancelled: CancellationException) { throw cancelled }
        catch (failed: Exception) { error = failed.message }
        finally { loading = false }
    }
    val response = remember(payload) { payload?.let { WireJson.parseToJsonElement(it).jsonObject } }
    val journal = response?.get("journal") as? JsonObject
    if (loading && journal == null) LinearProgressIndicator()
    error?.let { Text(it, color = WebPalette.Warning, style = ShareTypography.context) }
    if (journal != null) {
        ShareSection(journal.text("name").ifBlank { "Дневник" }) {
            val sections = journal["sections"].arrayValue()
            if (sections.isEmpty()) SheetEmpty("Записей пока нет")
            sections.forEach { raw ->
                val section = raw.objectValue()
                ShareSection(section.text("name").ifBlank { "Раздел" }) {
                    section["events"].arrayValue().forEach { value ->
                        val event = value.objectValue()
                        ShareTile {
                            Text(event.text("title").ifBlank { "Запись" }, style = ShareTypography.card)
                            SheetDescription(event.text("desc"))
                            event["payload"].objectValue()["dialogue"].arrayValue().forEach { row ->
                                val line = row.objectValue()
                                Text(line.text("name"), style = ShareTypography.group)
                                SheetDescription(line.text("text"))
                            }
                        }
                    }
                }
            }
        }
    } else if (!loading && error == null) SheetEmpty("Дневник пока не выбран")
    ShareTile {
        Text("Заметки", style = ShareTypography.card)
        SheetDescription(context.sheet.values.text("notes"))
    }
}
