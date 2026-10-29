package ru.dndshare.client.ui.character

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.data.*
import ru.dndshare.client.model.WireJson
import ru.dndshare.client.ui.LayoutFormat

internal class CharacterSheetViewModel(
    val uuid: String,
    private val accountId: Long,
    fallbackSourceId: Long,
    private val sheets: CharacterSheetRepository,
    cache: CacheDao,
    sheetCache: CharacterSheetDao,
    private val services: SheetServices,
    private val saved: SavedStateHandle,
    private val commands: CharacterCommandQueue? = null,
) : ViewModel() {
    private val snapshot =
        sheets
            .observe(uuid)
            .flowOn(Dispatchers.Default)
            .stateIn(viewModelScope, SharingStarted.Eagerly, null)
    private val navigation =
        saved
            .getStateFlow(NAVIGATION, "{}")
            .map {
                decodeSheetNavigation(it)
            }
            .onEach { if (it.sectionName == SheetSection.Inventory.name) services.icons?.load() }
            .stateIn(viewModelScope, SharingStarted.Eagerly, SheetNavigationState())
    private val editor =
        SheetEditorController(uuid, accountId, saved, sheetCache, sheets, viewModelScope)
    val remote = SheetRemoteController(uuid, services, sheets, viewModelScope)
    val campaign = CharacterCampaignController(uuid, services.api, commands, viewModelScope)
    private val fetchingContent = MutableStateFlow(true)
    private var contentRefreshJob: Job? = null
    private val content =
        SheetContentReader(
            cache,
            snapshot,
            editor.state.map { it?.fields?.target },
            fallbackSourceId,
            viewModelScope,
            editor.state.map { it?.fields?.input?.let(::referencedItems).orEmpty() },
            services.icons?.state ?: flowOf(InventoryIconsState()),
            fetchingContent,
        )
    val health = SheetHealthController(uuid, accountId, sheets)
    val itemMechanics =
        SheetItemMechanicsController(
            uuid,
            accountId,
            sheets,
            { content.state.value },
            { remote.state.value.sessionUuid },
            commands,
            { campaign.state.value.concentration },
        )
    val rolls =
        SheetRollController(
            uuid,
            sheets,
            { content.state.value },
            { remote.state.value.sessionUuid },
            commands,
            viewModelScope,
            saved,
            { campaign.state.value.concentration },
            cache = sheetCache,
            accountId = accountId,
        )
    private val loadError = MutableStateFlow<String?>(null)
    private val journalController =
        SheetJournalController(uuid, sheetCache, services, viewModelScope)
    private val journal = journalController.state
    private var refreshJob: Job? = null
    private val adjustments = Mutex()

    private val presentation =
        combine(navigation, editor.state, editor.restoring, journal, remote.state) {
            nav,
            form,
            restoring,
            journal,
            remote ->
            CharacterSheetUiState(
                navigation = nav,
                editor = form,
                restoringEditor = restoring,
                journal = journal,
                remote = remote,
            )
        }
    private val sessionPresentation =
        combine(
            presentation,
            campaign.state,
            commands?.state ?: MutableStateFlow(CharacterCommandState()),
            rolls.state,
        ) { ui, campaign, commands, roll ->
            ui.copy(campaign = campaign, commands = commands, roll = roll)
        }
    private val messages =
        combine(loadError, editor.error, sheets.message(uuid)) { load, form, save ->
            (load ?: form) to save
        }
    val uiState =
        combine(snapshot, content.state, sessionPresentation, messages) {
                sheet,
                content,
                ui,
                messages ->
                ui.copy(
                    snapshot = sheet,
                    content = content,
                    loadError = messages.first,
                    saveMessage = messages.second,
                )
            }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), CharacterSheetUiState())

    init {
        refresh()
        viewModelScope.launch {
            if (snapshot.filterNotNull().first().displayed.templateName == "DND5")
                journalController.refresh()
        }
        commands?.resume()
        viewModelScope.synchronizeSheetGrants(uuid, accountId, sheets, snapshot, content.state)
        viewModelScope.launch {
            remote.state.map { it.sessionUuid }.distinctUntilChanged().collect(campaign::bind)
        }
        if (commands != null) viewModelScope.launch { commands.state.collect(editor::commandState) }
        viewModelScope.launch {
            val cached =
                cache
                    .observeCharacters()
                    .first()
                    .map {
                        WireJson.decodeFromString<ru.dndshare.client.model.Character>(it.payload)
                    }
                    .firstOrNull { it.uuid == uuid }
            remote.seedSessions(cached?.sessions.orEmpty())
            val sheet = snapshot.filterNotNull().first().displayed
            if (sheet.userId == accountId)
                try {
                    remote.loadSessions()
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: Exception) {
                    /* Retain cached campaign membership while offline. */
                }
        }
        viewModelScope.launch {
            snapshot
                .filterNotNull()
                .map { it.displayed.sourceId }
                .distinctUntilChanged()
                .collectLatest { source ->
                    fetchingContent.value = true
                    try {
                        if (source > 0 && cache.syncState(source)?.ready != true) {
                            try {
                                services.synchronize(source)
                            } catch (cancelled: CancellationException) {
                                throw cancelled
                            } catch (_: Exception) {
                                /* Cached content remains available offline. */
                            }
                        }
                    } finally {
                        fetchingContent.value = false
                    }
                }
        }
        viewModelScope.launch {
            combine(
                    snapshot.map { it?.displayed?.templateName }.distinctUntilChanged(),
                    navigation.map { it.sectionName }.distinctUntilChanged(),
                ) { template, section ->
                    template == "DND5" && section == SheetSection.Journal.name
                }
                .distinctUntilChanged()
                .collectLatest { selected ->
                    if (selected) journalController.refresh()
                }
        }
    }

    private fun navigate(change: (SheetNavigationState) -> SheetNavigationState) {
        val current = decodeSheetNavigation(saved[NAVIGATION] ?: "{}")
        saved[NAVIGATION] = WireJson.encodeToString(change(current))
    }

    fun selectSection(section: SheetSection) {
        traceSheetNavigation { "model select=${section.name}" }
        navigate { it.copy(sectionName = section.name) }
    }

    fun formatChanged(format: LayoutFormat) {
        val sheet = snapshot.value?.displayed ?: return
        val sections = sheetSections(sheet.templateName, format)
        val current = decodeSheetNavigation(saved[NAVIGATION] ?: "{}")
        traceSheetNavigation { "format=$format saved=${current.sectionName}" }
        // A viewport fallback is presentation only. A transient wide window must not
        // replace Stats with its centre pane (Weapons) and save that as user intent.
        if (current.sectionName.isBlank()) selectSection(sections.first())
    }

    fun reloadInventoryIcons() {
        services.icons?.load(force = true)
    }

    fun edit(target: String) {
        if (target.startsWith("inventory")) services.icons?.load()
        val sheet = snapshot.value?.displayed ?: return
        if (target == "journal-refresh") {
            viewModelScope.launch { journalController.refresh() }
            return
        }
        if (target.startsWith("journal-order:") || target.startsWith("journal-source:")) {
            viewModelScope.launch {
                try {
                    val response =
                        uiState.value.journal.payload ?: error("Дневник ещё не загружен.")
                    val command =
                        if (target.startsWith("journal-source:"))
                            journalFormCommand(
                                initialForm(target, sheet)
                                    .copy(input = initialJournalInput(target, response)),
                                uuid,
                            )
                        else journalOrderCommand(target, response)
                    requireNotNull(commands).send(command.route, command.intent, false)
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (error: Exception) {
                    loadError.value = error.message
                }
            }
            return
        }
        if (target == "concentration-end") {
            campaign.endConcentration()
            return
        }
        if (
            (target.startsWith("weapon-roll:") || target.startsWith("spell-roll:")) &&
                sheet.userId == accountId
        )
            navigate { it.copy(overlay = target) }
        else if (target in setOf("menu", "campaign")) navigate { it.copy(overlay = target) }
        else if (sheet.userId == accountId) {
            navigate { it.copy(overlay = null) }
            val seed =
                if (target.startsWith("journal-"))
                    runCatching {
                        JsonObject(
                            initialJournalInput(
                                target,
                                requireNotNull(uiState.value.journal.payload),
                            ) + ("characterUuid" to JsonPrimitive(uuid))
                        )
                    }
                        .getOrElse {
                            loadError.value = it.message
                            return
                        }
                else null
            editor.open(
                target,
                sheet,
                content.state.value.items,
                remote.state.value.sessionUuid,
                seed,
            )
        }
    }

    fun number(field: SheetNumberField, value: String) = editor.number(field, value)

    fun calculateHealth(kind: String, expression: String) =
        editor.calculateHealth(kind, expression, content.state.value.items)

    fun inspiration(value: Boolean) = editor.inspiration(value)

    fun adjustResource(key: String, delta: Int) {
        viewModelScope.launch {
            try {
                adjustments.withLock {
                    val sheet = requireNotNull(sheets.local(uuid)).displayed
                    require(sheet.userId == accountId)
                    val resource =
                        resourceControls(sheet, content.state.value.items).firstOrNull {
                            it.key == key
                        } ?: error("Ресурс больше не доступен.")
                    val amount = (resource.value + delta).coerceIn(0, resource.total)
                    if (amount == resource.value) return@withLock
                    val patches =
                        resourceChangePatches(sheet, resource, amount, content.state.value.items)
                    val metadata =
                        sessionMetadata(
                            remote.state.value.sessionUuid,
                            "resource_used",
                            if (delta < 0) "Использование ячеек" else "Восстановление ячеек",
                            buildJsonObject {
                                put("resourceKey", resource.key)
                                put("remaining", amount)
                                put("total", resource.total)
                                put(
                                    "resourceChanges",
                                    buildJsonArray {
                                        add(
                                            buildJsonObject {
                                                put("key", resource.key)
                                                put("name", resource.title)
                                                put("delta", amount - resource.value)
                                                put("remaining", amount)
                                                put("total", resource.total)
                                            }
                                        )
                                    },
                                )
                            },
                        )
                    sheets.enqueue(uuid, patches, sheet.data, metadata = metadata)
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                loadError.value = error.message
            }
        }
    }

    fun history(forward: Boolean = false) {
        if (editor.state.value != null || commands?.state?.value?.pending == true) return
        viewModelScope.launch {
            try {
                sheets.history(uuid, forward)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                loadError.value = error.message
            }
        }
    }

    fun formInput(): JsonObject = editor.state.value?.fields?.input ?: JsonObject(emptyMap())

    fun input(key: String, value: kotlinx.serialization.json.JsonElement) = editor.input(key, value)

    fun status(id: Long, selected: Boolean) = editor.status(id, selected)

    fun dismissEditor() = editor.dismiss()

    fun submitEditor() {
        val data = content.state.value
        val items = data.items + data.availableStates.associateBy { it.id }
        if (editor.state.value?.fields?.target in setOf("portrait", "icon")) {
            services.api?.let { editor.submitImage(it, commands) }
        } else if (editor.state.value?.fields?.target?.let(::isCommandForm) == true) {
            commands?.let { editor.submitCommand(it, items, data.metadata) }
        } else editor.submit(items, remote.state.value.sessionUuid, data.metadata)
    }

    fun dismissOverlay() = navigate { it.copy(overlay = null) }

    fun openItem(id: Long) = navigate { it.pushItem(id) }

    fun openSpell(key: String, id: Long) = navigate { it.pushItem(id, key) }

    fun closeItem() = navigate { it.popItem() }

    fun confirmReload(show: Boolean) = navigate { it.copy(discardDialog = show) }

    fun refresh() {
        if (refreshJob?.isActive == true) return
        refreshJob = viewModelScope.launch {
            loadError.value = null
            try {
                sheets.refresh(uuid)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                loadError.value = error.message ?: "Не удалось загрузить лист персонажа."
            }
        }
    }

    fun refreshContent() {
        if (contentRefreshJob?.isActive == true) return
        contentRefreshJob = viewModelScope.launch {
            fetchingContent.value = true
            try {
                services.synchronize(snapshot.value?.displayed?.sourceId ?: return@launch)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                // A failed attempt settles the skeleton; each unresolved card can retry.
            } finally {
                fetchingContent.value = false
            }
        }
    }

    fun retryCommand() {
        commands?.resume()
    }

    suspend fun poll() {
        remote.poll()
        campaign.reload()
        journalController.poll(
            navigation.value.sectionName == SheetSection.Journal.name,
            editor.state.value != null,
        )
    }

    fun retrySave() {
        viewModelScope.launch { sheets.clearBlock(uuid) }
    }

    fun reload() {
        viewModelScope.launch {
            try {
                sheets.reload(uuid)
                confirmReload(false)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                loadError.value = error.message
            }
        }
    }

    companion object {
        private const val NAVIGATION = "sheet.navigation"
    }
}
