package ru.dndshare.client.ui.character

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.encodeToString
import ru.dndshare.client.character.*
import ru.dndshare.client.data.*
import ru.dndshare.client.model.WireJson
import ru.dndshare.client.ui.LayoutFormat

internal class CharacterSheetViewModel(
    private val uuid: String, private val accountId: Long, fallbackSourceId: Long,
    private val sheets: CharacterSheetRepository, cache: CacheDao, sheetCache: CharacterSheetDao,
    private val services: SheetServices, private val saved: SavedStateHandle,
) : ViewModel() {
    private val snapshot = sheets.observe(uuid).flowOn(Dispatchers.Default).stateIn(viewModelScope, SharingStarted.Eagerly, null)
    private val navigation = saved.getStateFlow(NAVIGATION, "{}").map {
        WireJson.decodeFromString<SheetNavigationState>(it)
    }.stateIn(viewModelScope, SharingStarted.Eagerly, SheetNavigationState())
    private val editor = SheetEditorController(uuid, accountId, saved, sheetCache, sheets, viewModelScope)
    private val content = SheetContentReader(cache, snapshot, editor.state.map { it?.fields?.target }, fallbackSourceId, viewModelScope)
    private val loadError = MutableStateFlow<String?>(null)
    private val journalProgress = MutableStateFlow(false to (null as String?))
    private val journal = combine(sheetCache.observeSection(uuid, "journal"), journalProgress) { payload, progress ->
        SheetJournalState(payload?.let { WireJson.parseToJsonElement(it) as kotlinx.serialization.json.JsonObject }, progress.first, progress.second)
    }.flowOn(Dispatchers.Default)
    private var refreshJob: Job? = null

    private val presentation = combine(navigation, editor.state, editor.restoring, journal) { nav, form, restoring, journal ->
        CharacterSheetUiState(navigation = nav, editor = form, restoringEditor = restoring, journal = journal)
    }
    private val messages = combine(loadError, editor.error, sheets.message(uuid)) { load, form, save -> (load ?: form) to save }
    val uiState = combine(snapshot, content.state, presentation, messages) { sheet, content, ui, messages ->
        ui.copy(snapshot = sheet, content = content, loadError = messages.first, saveMessage = messages.second)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), CharacterSheetUiState())

    init {
        refresh()
        viewModelScope.launch {
            snapshot.filterNotNull().map { it.displayed.sourceId }.distinctUntilChanged().collectLatest { source ->
                if (source > 0 && cache.syncState(source)?.ready != true) {
                    try { services.synchronize(source) }
                    catch (cancelled: CancellationException) { throw cancelled }
                    catch (_: Exception) { /* Cached content remains available offline. */ }
                }
            }
        }
        viewModelScope.launch {
            combine(snapshot.map { it?.displayed?.templateName }.distinctUntilChanged(), navigation.map { it.sectionName }.distinctUntilChanged()) {
                template, section -> template == "DND5" && section == SheetSection.Journal.name
            }.distinctUntilChanged().collectLatest { selected ->
                if (selected) {
                    journalProgress.value = true to null
                    try { services.refreshJournal() }
                    catch (cancelled: CancellationException) { throw cancelled }
                    catch (error: Exception) { journalProgress.value = false to error.message }
                    finally { journalProgress.value = false to journalProgress.value.second }
                }
            }
        }
    }

    private fun navigate(change: (SheetNavigationState) -> SheetNavigationState) {
        val current = WireJson.decodeFromString<SheetNavigationState>(saved[NAVIGATION] ?: "{}")
        saved[NAVIGATION] = WireJson.encodeToString(change(current))
    }

    fun selectSection(section: SheetSection) = navigate { it.copy(sectionName = section.name) }
    fun formatChanged(format: LayoutFormat) {
        val sheet = snapshot.value?.displayed ?: return
        val sections = sheetSections(sheet.templateName, format)
        val current = WireJson.decodeFromString<SheetNavigationState>(saved[NAVIGATION] ?: "{}")
        if (sections.none { it.name == current.sectionName }) selectSection(sections.first())
    }

    fun edit(target: String) {
        val sheet = snapshot.value?.displayed ?: return
        if (target in listOf("menu", "rest")) navigate { it.copy(overlay = target) }
        else if (sheet.userId == accountId) {
            navigate { it.copy(overlay = null) }
            editor.open(target, sheet)
        }
    }
    fun number(field: SheetNumberField, value: String) = editor.number(field, value)
    fun inspiration(value: Boolean) = editor.inspiration(value)
    fun status(id: Long, selected: Boolean) = editor.status(id, selected)
    fun dismissEditor() = editor.dismiss()
    fun submitEditor() {
        val data = content.state.value
        editor.submit(data.items + data.availableStates.associateBy { it.id })
    }
    fun dismissOverlay() = navigate { it.copy(overlay = null) }
    fun openItem(id: Long) = navigate { it.copy(itemStack = it.itemStack + id) }
    fun closeItem() = navigate { it.copy(itemStack = it.itemStack.dropLast(1)) }
    fun confirmReload(show: Boolean) = navigate { it.copy(discardDialog = show) }

    fun refresh() {
        if (refreshJob?.isActive == true) return
        refreshJob = viewModelScope.launch {
            loadError.value = null
            try { sheets.refresh(uuid) }
            catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) { loadError.value = error.message ?: "Не удалось загрузить лист персонажа." }
        }
    }
    fun retrySave() { viewModelScope.launch { sheets.clearBlock(uuid) } }
    fun reload() { viewModelScope.launch {
        try { sheets.reload(uuid); confirmReload(false) }
        catch (cancelled: CancellationException) { throw cancelled }
        catch (error: Exception) { loadError.value = error.message }
    } }

    companion object { private const val NAVIGATION = "sheet.navigation" }
}
