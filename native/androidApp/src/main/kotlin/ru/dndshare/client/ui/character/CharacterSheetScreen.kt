package ru.dndshare.client.ui.character

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil3.ImageLoader
import ru.dndshare.client.character.*
import ru.dndshare.client.data.CacheDao
import ru.dndshare.client.ui.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun CharacterSheetScreen(ui: CharacterSheetUiState, model: CharacterSheetViewModel,
    accountId: Long, cache: CacheDao, format: LayoutFormat, images: ImageLoader, active: Boolean, close: () -> Unit) {
    val sheet = ui.sheet
    val navigation = ui.navigation
    val sections = sheetSections(sheet?.templateName ?: "DND5", format)
    val section = sections.firstOrNull { it.name == navigation.sectionName } ?: sections.first()
    val wideDnd = format == LayoutFormat.Wide && sheet?.templateName == "DND5"
    val pager = if (sheet != null && !wideDnd) rememberSheetPager(sections, section, model::selectSection) else null
    val visibleSection = pager?.let { sections.getOrNull(it.currentPage) } ?: section
    val swipeEnabled = active && ui.editor == null && !ui.restoringEditor && navigation.overlay == null
    val panes = rememberSaveableStateHolder()
    val canEdit = active && sheet?.userId == accountId
    val morph = rememberShareMorphState()
    LaunchedEffect(format, sheet?.templateName) { model.formatChanged(format) }
    BackHandler(enabled = active) {
        when {
            ui.editor != null -> model.dismissEditor()
            ui.restoringEditor -> Unit
            navigation.overlay != null -> model.dismissOverlay()
            navigation.itemStack.isNotEmpty() -> model.closeItem()
            else -> close()
        }
    }
    val mechanics = remember(sheet, ui.content) { sheet?.let { DndDerivedValues(it, ui.content.items, ui.content.metadata) } }
    CompositionLocalProvider(LocalShareMorphState provides morph) {
    Column(Modifier.fillMaxSize().shareMorphBackground(morph)) {
        CharacterSheetHeader(sheet, format, sections, visibleSection, images, model::selectSection, close, mechanics, menu = { model.edit("menu") })
        if (ui.snapshot?.draft?.edits?.isNotEmpty() == true) {
            SheetSaveStatus(ui.snapshot.draft.blocked ?: ui.saveMessage, model::retrySave, reload = { model.confirmReload(true) })
        }
        ui.loadError?.let { message -> Surface(color = WebPalette.Raised) {
            Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(message, Modifier.weight(1f), style = ShareTypography.context)
                TextButton(onClick = model::refresh) { Text("Повторить") }
            }
        } }
        when {
            sheet == null && ui.loadError == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            sheet != null && sheet.templateName !in listOf("DND5", "VTM20") -> EmptyContent("Система пока не поддерживается", sheet.sourceName)
            sheet != null -> CompositionLocalProvider(LocalCharacterSheet provides SheetContext(
                sheet, ui.content.metadata, ui.content.items, images, canEdit,
                edit = { if (canEdit || it in listOf("menu", "rest")) model.edit(it) }, openItem = model::openItem,
                mechanics = requireNotNull(mechanics), journal = ui.journal, editor = ui.editor)) {
                if (!canEdit) Text("Режим просмотра", Modifier.padding(horizontal = 20.dp, vertical = 4.dp), style = ShareTypography.context, color = WebPalette.TextSecondary)
                if (format == LayoutFormat.Phone && sheet.templateName == "DND5") DndPhoneSummary()
                if (format == LayoutFormat.Phone) SheetNavigation(sections, visibleSection, images, model::selectSection, compact = true, template = sheet.templateName)
                Box(Modifier.weight(1f).fillMaxWidth()) {
                    if (wideDnd) DndWideSheet(section, sections, model::selectSection, swipeEnabled)
                    else SheetPagerContent(requireNotNull(pager), sections, Modifier.fillMaxSize(), beyondViewportPageCount = 1,
                        userScrollEnabled = swipeEnabled) { page -> panes.SaveableStateProvider(sections[page].name) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                        Column(Modifier.widthIn(max = DesignTokens.Layout.SheetMax).fillMaxSize().verticalScroll(rememberScrollState())
                            .padding(DesignTokens.Spacing.Page), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            if (sheet.templateName == "DND5") DndSheetSection(sections[page], format) else VtmSheetSection(sections[page], format)
                        }
                        }
                    } }
                }
                ui.editor?.takeUnless { it.isDndStat() }?.let { editor -> CharacterSheetEditor(editor, ui.content.availableStates,
                    model::dismissEditor, model::number, model::inspiration, model::status, model::submitEditor) }
                SheetStatMorph(morph, ui.editor, model::dismissEditor, model::number, model::submitEditor)
                navigation.overlay?.let { target -> SheetInformationDialog(target, sheet, model::dismissOverlay, close, model::refresh) }
                if (navigation.itemStack.isNotEmpty()) Dialog(onDismissRequest = model::closeItem,
                    properties = DialogProperties(usePlatformDefaultWidth = false)) {
                    ItemDetail(cache, sheet.sourceId, navigation.itemStack.last(), ui.content.metadata, images,
                        back = model::closeItem, open = model::openItem)
                }
            }
        }
    }
    if (navigation.discardDialog) AlertDialog(onDismissRequest = { model.confirmReload(false) }, title = { Text("Загрузить серверную версию?") },
        text = { Text("Локальный черновик будет заменён текущим листом с сервера.") },
        confirmButton = { TextButton(onClick = model::reload) { Text("Загрузить") } },
        dismissButton = { TextButton(onClick = { model.confirmReload(false) }) { Text("Отмена") } })
    }
}

@Composable
private fun SheetSaveStatus(message: String?, retry: () -> Unit, reload: () -> Unit) {
    Surface(color = WebPalette.Raised) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(message ?: "Сохраняем изменения…", Modifier.weight(1f), style = ShareTypography.context,
                color = if (message != null) WebPalette.Warning else WebPalette.TextSecondary)
            if (message != null) {
                TextButton(onClick = retry) { Text("Повторить") }
                TextButton(onClick = reload) { Text("Версия сервера") }
            }
        }
    }
}
