package ru.dndshare.client.ui.creation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlin.random.Random
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import ru.dndshare.client.app.AppController
import ru.dndshare.client.character.*
import ru.dndshare.client.character.creation.*
import ru.dndshare.client.model.*
import ru.dndshare.client.network.*

data class CreationUiState(
    val draft: CreationDraft = CreationDraft(),
    val catalogue: List<CatalogueItem> = emptyList(),
    val metadata: HandbookMetadata = HandbookMetadata(),
    val rules: JsonObject = JsonObject(emptyMap()),
    val templates: List<CharacterTemplate> = emptyList(),
    val sources: List<GameSource> = emptyList(),
    val loading: Boolean = true,
    val busy: Boolean = false,
    val error: String? = null,
    val created: String? = null,
    val inputRevision: Int = 0,
    val needsAuth: Boolean = false,
    val partialAfterAuth: Boolean = false,
) {
    val context
        get() = CreationContext(draft, catalogue, metadata, rules)
}

internal class CharacterCreationViewModel(
    private val app: AppController,
    owner: Long,
    private val readRules: suspend () -> JsonObject,
) : ViewModel() {
    private val storageKey = "character-creation:$owner"
    private val restored =
        app.platform.secureStore.read(storageKey)?.let {
            runCatching { WireJson.decodeFromString<CreationDraft>(it) }.getOrNull()
        } ?: CreationDraft()
    private val mutable = MutableStateFlow(CreationUiState(draft = restored))
    val state = mutable.asStateFlow()
    private var loader: Job? = null
    private var writer: Job? = null

    init {
        load()
    }

    fun update(change: (CreationDraft) -> CreationDraft) {
        if (mutable.value.busy) return
        val draft = change(mutable.value.draft)
        mutable.update { it.copy(draft = draft, error = null) }
        val previous = writer
        previous?.cancel()
        writer =
            viewModelScope.launch(Dispatchers.IO) {
                previous?.join()
                delay(150)
                app.platform.secureStore.write(storageKey, WireJson.encodeToString(draft))
            }
    }

    fun choose(key: String, id: Long) = update { draft ->
        chooseCreationItem(state.value.context.copy(draft = draft), key, id)
    }

    fun variant(value: String) = update { draft ->
        chooseCreationVariant(state.value.context.copy(draft = draft), value)
    }

    fun pick(key: String, value: String, limit: Int) = update { draft ->
        pickCreationChoice(state.value.context.copy(draft = draft), key, value, limit)
    }

    fun system(template: String, version: String) {
        update { CreationDraft(template = template, version = version) }
        load()
    }

    fun edition(version: String) {
        update {
            it.copy(
                version = version,
                selected = emptyMap(),
                choices = emptyMap(),
                backgroundAsi = emptyMap(),
                equipmentChoices = JsonObject(emptyMap()),
                wealth = null,
            )
        }
        load()
    }

    fun load() {
        loader?.cancel()
        loader = viewModelScope.launch {
            mutable.update { it.copy(loading = true, error = null) }
            try {
                val templates = runCatching {
                    app.api.templates()
                }
                    .getOrElse {
                        app.platform.secureStore.read("character-templates")?.let { saved ->
                            WireJson.decodeFromString(saved)
                        } ?: throw it
                    }
                app.platform.secureStore.write(
                    "character-templates",
                    WireJson.encodeToString(templates),
                )
                val sources = app.state.value.sources.ifEmpty { app.api.sources() }
                val draft = mutable.value.draft
                val sourceName = if (draft.template == "VTM20") "Vampire: TM" else "DND5e"
                val source =
                    sources.firstOrNull { it.name.equals(sourceName, true) }
                        ?: error("Игровая система недоступна.")
                val edition =
                    source.versions.firstOrNull { it.version == draft.version }
                        ?: error("Редакция ${draft.version} недоступна.")
                val rules = mutable.value.rules.ifEmpty { readRules() }
                mutable.update {
                    it.copy(
                        templates = templates,
                        sources = sources,
                        rules = rules,
                        draft = it.draft.copy(editionId = edition.id),
                    )
                }
                if (draft.template == "VTM20") {
                    mutable.update { it.copy(catalogue = emptyList()) }
                    return@launch
                }
                val repository = app.state.value.repository
                val cached = repository?.cache?.syncState(source.id)?.ready == true
                val metadata =
                    if (cached)
                        repository!!.cache.observeMetadata(source.id).first()?.let {
                            WireJson.decodeFromString<HandbookMetadata>(it.payload)
                        } ?: app.api.creationMetadata(source.id, edition.id)
                    else app.api.creationMetadata(source.id, edition.id)
                val kinds =
                    listOf(
                        8L,
                        16L,
                        9L,
                        17L,
                        3L,
                        4L,
                        5L,
                        7L,
                        11L,
                        1L,
                        2L,
                        10L,
                        12L,
                        13L,
                        14L,
                        18L,
                        19L,
                    )
                val semaphore = Semaphore(4)
                val catalogue = coroutineScope {
                    kinds
                        .map { type ->
                            async(Dispatchers.IO) {
                                semaphore.withPermit {
                                    if (cached)
                                        repository!!
                                            .cache
                                            .observeItems(
                                                source.id,
                                                type,
                                                "%|${edition.id}|%",
                                                "%",
                                                100_000,
                                            )
                                            .first()
                                            .map {
                                                WireJson.decodeFromString<CatalogueItem>(it.payload)
                                            }
                                    else app.api.catalogue(type, edition.id)
                                }
                            }
                        }
                        .awaitAll()
                        .flatten()
                }
                mutable.update { it.copy(catalogue = catalogue, metadata = metadata) }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                mutable.update {
                    it.copy(error = error.message ?: "Не удалось загрузить данные для создания.")
                }
            } finally {
                mutable.update { it.copy(loading = false) }
            }
        }
    }

    fun next() {
        val ui = mutable.value
        val errors =
            creationErrors(ui.context, ui.draft.step) +
                if (ui.draft.step == 2) equipmentErrors(ui.context) else emptyList()
        if (errors.isNotEmpty()) {
            mutable.update { it.copy(error = errors.first()) }
            return
        }
        update {
            it.copy(
                step =
                    (it.step + 1).coerceAtMost(
                        if (it.buyEquipment && it.version == "2014") 6 else 5
                    )
            )
        }
    }

    fun rollScores() = update {
        it.copy(
            method = "roll",
            rolls = List(6) { List(4) { Random.nextInt(1, 7) } },
            assignments = emptyMap(),
        )
    }

    fun quickScores() = update { draft ->
        val priority =
            mutable.value.context
                .item("charClass")
                ?.data
                ?.get("primary_abilities")
                .arrayValue()
                .mapNotNull { creationStats.getOrNull(it.number() - 1) }
        val order = (priority + listOf("CON", "DEX") + creationStats).distinct()
        draft.copy(
            method = "array",
            assignments = order.mapIndexed { index, key -> key to index }.toMap(),
        )
    }

    fun randomName() {
        val ui = mutable.value
        val race = ui.context.item("subrace") ?: ui.context.item("race")
        val label =
            "${race?.name.orEmpty()} ${race?.nameEn.orEmpty()}"
                .lowercase()
                .replace('ё', 'е')
                .replace('-', ' ')
        val names = ui.rules["names"].arrayValue().map { it.objectValue() }
        val profile =
            names.firstOrNull { row ->
                row["aliases"].arrayValue().any { it.jsonPrimitive.content in label }
            } ?: names.lastOrNull() ?: return
        val given = profile["given"].arrayValue().random().jsonPrimitive.content
        val family =
            profile["family"]
                .arrayValue()
                .map { it.jsonPrimitive.content }
                .filter { "$given $it" != ui.draft.name }
                .random()
        update { it.copy(name = "$given $family") }
        mutable.update { it.copy(inputRevision = it.inputRevision + 1) }
    }

    fun cancelAuth() {
        mutable.update { it.copy(needsAuth = false) }
    }

    fun reset() {
        update { CreationDraft() }
        load()
    }

    fun create(partial: Boolean = false) {
        val ui = mutable.value
        if (ui.busy || ui.loading) return
        if (!partial) {
            val errors =
                (0..5).flatMap { creationErrors(ui.context, it) } + equipmentErrors(ui.context)
            if (errors.isNotEmpty()) {
                mutable.update { it.copy(error = errors.first()) }
                return
            }
        }
        if (app.state.value.user == null) {
            mutable.update { it.copy(needsAuth = true, partialAfterAuth = partial) }
            return
        }
        mutable.update { it.copy(busy = true, error = null, needsAuth = false) }
        viewModelScope.launch {
            try {
                val template =
                    ui.templates.firstOrNull { it.name == ui.draft.template }
                        ?: error("Шаблон недоступен.")
                writer?.cancelAndJoin()
                var draft = ui.draft
                val portrait = draft.media["portrait:path"].orEmpty()
                val icon = draft.media["icon:path"].orEmpty()
                if (portrait.isNotBlank() && draft.portraitUpload == null) {
                    draft =
                        draft.copy(
                            portraitUpload = app.api.uploadCharacterImage(java.io.File(portrait))
                        )
                    app.platform.secureStore.write(storageKey, WireJson.encodeToString(draft))
                    mutable.update { it.copy(draft = draft) }
                }
                if (icon.isNotBlank() && draft.iconUploadId == null) {
                    val uploaded =
                        app.api.uploadCharacterImage(java.io.File(icon), iconPurpose = true)
                    draft = draft.copy(iconUploadId = uploaded["upload_id"].referenceId())
                    app.platform.secureStore.write(storageKey, WireJson.encodeToString(draft))
                    mutable.update { it.copy(draft = draft) }
                }
                val data =
                    withContext(Dispatchers.Default) {
                        assembleCharacter(
                            CreationContext(draft, ui.catalogue, ui.metadata, ui.rules)
                        )
                    }
                val uuid =
                    app.api.createCharacter(template.id, draft.editionId, data, draft.iconUploadId)
                writer?.cancelAndJoin()
                app.platform.secureStore.write(storageKey, null)
                app.refresh(force = true)
                mutable.update { it.copy(created = uuid) }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                mutable.update {
                    it.copy(
                        error = error.message ?: "Не удалось создать персонажа. Черновик сохранён."
                    )
                }
            } finally {
                mutable.update { it.copy(busy = false) }
            }
        }
    }
}
