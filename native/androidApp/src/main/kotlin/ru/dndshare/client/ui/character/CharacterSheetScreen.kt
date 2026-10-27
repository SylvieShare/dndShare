package ru.dndshare.client.ui.character

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil3.ImageLoader
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import ru.dndshare.client.app.AppState
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.*
import ru.dndshare.designsystem.*

@Composable
fun CharacterSheetScreen(uuid: String, state: AppState, format: LayoutFormat, images: ImageLoader, active: Boolean, close: () -> Unit) {
    val repository = state.repository ?: return
    val sheets = repository.sheets
    val snapshot by remember(uuid, sheets) { sheets.observe(uuid) }.collectAsState(null)
    val networkMessage by remember(uuid, sheets) { sheets.message(uuid) }.collectAsState(null)
    val scope = rememberCoroutineScope()
    var loadError by remember(uuid) { mutableStateOf<String?>(null) }
    var editor by rememberSaveable(uuid) { mutableStateOf<String?>(null) }
    var discardDialog by rememberSaveable(uuid) { mutableStateOf(false) }
    var sectionName by rememberSaveable(uuid) { mutableStateOf("") }
    var itemStack by rememberSaveable(uuid) { mutableStateOf<List<Long>>(emptyList()) }
    val displayed = snapshot?.displayed
    val sourceId = displayed?.sourceId ?: state.sourceId
    val metadata by remember(sourceId, repository) { repository.cache.observeMetadata(sourceId)
        .map { row -> row?.let { WireJson.decodeFromString<HandbookMetadata>(it.payload) } ?: HandbookMetadata() }
    }.collectAsState(HandbookMetadata())
    val directIds = remember(displayed?.data) { displayed?.data?.let(::referencedItems).orEmpty() }
    var dependencies by remember(sourceId) { mutableStateOf<List<Long>>(emptyList()) }
    val ids = (directIds + dependencies).distinct().sorted()
    val itemFlow = remember(sourceId, ids, repository) {
        val queries = ids.chunked(300).map { repository.cache.observeReferencedItems(sourceId, it) }
        if (queries.isEmpty()) flowOf(emptyMap<Long, CatalogueItem>())
        else combine(queries) { rows -> rows.flatMap { it }.associate { row -> row.id to WireJson.decodeFromString<CatalogueItem>(row.payload) } }
    }
    val items by itemFlow.collectAsState(emptyMap())
    LaunchedEffect(items) {
        dependencies = items.values.flatMap { item -> listOfNotNull(
            item.data["armor_base"].objectValue()["base_item_id"].referenceId(),
            item.data["weapon"].objectValue()["base_item_id"].referenceId(),
            item.data["on_end_effect"].referenceId()) }.distinct().sorted()
    }
    val availableStates by remember(editor, sourceId, repository, displayed?.sourceVersionId) {
        if (editor == "statuses") repository.cache.observeItems(sourceId, 15L,
            displayed?.sourceVersionId?.let { "%|$it|%" }.orEmpty(), "%", 300)
            .map { rows -> rows.map { WireJson.decodeFromString<CatalogueItem>(it.payload) } }
        else flowOf(emptyList())
    }.collectAsState(emptyList())
    suspend fun refresh() {
        loadError = null
        try { sheets.refresh(uuid) }
        catch (cancelled: CancellationException) { throw cancelled }
        catch (error: Exception) { loadError = error.message ?: "Не удалось загрузить лист персонажа." }
    }
    LaunchedEffect(uuid, sheets) { refresh() }
    LaunchedEffect(sourceId, displayed?.templateName) {
        if (displayed != null && sourceId > 0 && repository.cache.syncState(sourceId)?.ready != true) {
            try { repository.synchronize(sourceId) { } }
            catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { /* The cached sheet stays available while offline. */ }
        }
    }
    val sections = sheetSections(displayed?.templateName ?: "DND5", format)
    val section = sections.firstOrNull { it.name == sectionName } ?: sections.first()
    LaunchedEffect(format, displayed?.templateName) { if (displayed != null && sections.none { it.name == sectionName }) sectionName = section.name }
    BackHandler(enabled = active) { if (editor != null) editor = null else close() }
    val canEdit = active && displayed?.userId == state.user?.id
    val panes = rememberSaveableStateHolder()

    Column(Modifier.fillMaxSize()) {
        val mechanics = remember(displayed, metadata, items) { displayed?.let { DndDerivedValues(it, items, metadata) } }
        CharacterSheetHeader(displayed, format, sections, section, images, { sectionName = it.name }, close, mechanics, menu = { editor = "menu" })
        if (snapshot?.draft?.edits?.isNotEmpty() == true) {
            SheetSaveStatus(snapshot?.draft?.blocked ?: networkMessage,
                retry = { scope.launch { sheets.clearBlock(uuid) } }, reload = { discardDialog = true })
        }
        if (loadError != null) Surface(color = WebPalette.Raised) {
            Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(loadError.orEmpty(), Modifier.weight(1f), style = ShareTypography.context)
                TextButton(onClick = { scope.launch { refresh() } }) { Text("Повторить") }
            }
        }
        when {
            displayed == null && loadError == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            displayed != null && displayed.templateName !in listOf("DND5", "VTM20") -> EmptyContent("Система пока не поддерживается", displayed.sourceName)
            displayed != null -> CompositionLocalProvider(LocalCharacterSheet provides SheetContext(displayed, metadata, items, images, canEdit,
                edit = { if (canEdit || it in listOf("menu", "rest")) editor = it }, cache = repository.cache, openItem = { itemStack = itemStack + it },
                mechanics = remember(displayed, metadata, items) { DndDerivedValues(displayed, items, metadata) }, uuid = uuid, repository = repository)) {
                if (!canEdit) Text("Режим просмотра", Modifier.padding(horizontal = 20.dp, vertical = 4.dp), style = ShareTypography.context, color = WebPalette.TextSecondary)
                if (format == LayoutFormat.Phone && displayed.templateName == "DND5") DndPhoneSummary()
                if (format == LayoutFormat.Phone) SheetNavigation(sections, section, images, { sectionName = it.name }, compact = true, template = displayed.templateName)
                Box(Modifier.weight(1f).fillMaxWidth()) {
                    if (format == LayoutFormat.Wide && displayed.templateName == "DND5") {
                        DndWideSheet(section, sections, { sectionName = it.name })
                    } else panes.SaveableStateProvider(section.name) {
                        Column(Modifier.widthIn(max = DesignTokens.Layout.SheetMax).fillMaxSize().verticalScroll(rememberScrollState())
                            .align(Alignment.TopCenter)
                            .padding(DesignTokens.Spacing.Page), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            if (displayed.templateName == "DND5") DndSheetSection(section, format)
                            else VtmSheetSection(section, format)
                        }
                    }
                }
                if (editor != null) CharacterSheetEditor(editor!!, displayed, metadata, availableStates, close = { editor = null }, knownItems = items, backToList = close, refresh = { refresh() }) { patches, expected ->
                    sheets.enqueue(uuid, patches, expected)
                }
                if (itemStack.isNotEmpty()) Dialog(onDismissRequest = { itemStack = itemStack.dropLast(1) },
                    properties = DialogProperties(usePlatformDefaultWidth = false)) {
                    ItemDetail(repository.cache, sourceId, itemStack.last(), metadata, images,
                        back = { itemStack = itemStack.dropLast(1) }, open = { itemStack = itemStack + it })
                }
            }
        }
    }
    if (discardDialog) AlertDialog(onDismissRequest = { discardDialog = false }, title = { Text("Загрузить серверную версию?") },
        text = { Text("Локальный черновик будет заменён текущим листом с сервера.") },
        confirmButton = { TextButton(onClick = { scope.launch {
            try { sheets.reload(uuid); discardDialog = false }
            catch (error: Exception) { loadError = error.message }
        } }) { Text("Загрузить") } },
        dismissButton = { TextButton(onClick = { discardDialog = false }) { Text("Отмена") } })
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
