package ru.dndshare.client.ui.creation

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil3.ImageLoader
import ru.dndshare.client.character.*
import ru.dndshare.client.character.creation.*
import ru.dndshare.client.ui.*
import ru.dndshare.client.ui.character.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun CreationPreview(ui: CreationUiState, images: ImageLoader, close: () -> Unit) {
    val result = remember(ui.draft, ui.catalogue) { runCatching { assembleCharacter(ui.context) } }
    Dialog(close, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize(), color = WebPalette.Background) {
            BoxWithConstraints(
                Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)
            ) {
                val format = layoutFormat(maxWidth.value)
                val sheet =
                    result.getOrNull()?.let {
                        CharacterSheet("DND5", 0, it, 1, sourceVersion = ui.draft.version)
                    }
                if (sheet == null)
                    ShareFormDialog("Предпросмотр", close) {
                        Text(result.exceptionOrNull()?.message ?: "Заполните параметры персонажа.")
                    }
                else {
                    val sections = sheetSections("DND5", format)
                    var selected by remember { mutableStateOf(sections.first()) }
                    val section = selected.takeIf { it in sections } ?: sections.first()
                    val items = ui.context.items
                    val mechanics =
                        remember(sheet, items) { DndDerivedValues(sheet, items, ui.metadata) }
                    CompositionLocalProvider(
                        LocalCharacterSheet provides
                            SheetContext(
                                sheet,
                                ui.metadata,
                                items,
                                images,
                                false,
                                {},
                                {},
                                mechanics,
                                SheetJournalState(),
                            )
                    ) {
                        Column {
                            CharacterSheetHeader(
                                sheet,
                                format,
                                sections,
                                section,
                                images,
                                { selected = it },
                                close,
                            )
                            if (format == LayoutFormat.Wide)
                                DndWideSheet(section, sections, { selected = it })
                            else
                                Column(
                                    Modifier.fillMaxSize()
                                        .verticalScroll(rememberScrollState())
                                        .padding(20.dp),
                                    verticalArrangement = Arrangement.spacedBy(16.dp),
                                ) {
                                    SheetNavigation(sections, section, images, { selected = it })
                                    DndSheetSection(section, format)
                                }
                        }
                    }
                }
            }
        }
    }
}
