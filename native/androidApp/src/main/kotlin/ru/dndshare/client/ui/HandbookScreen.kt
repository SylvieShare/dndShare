package ru.dndshare.client.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import coil3.ImageLoader
import kotlinx.serialization.json.*
import ru.dndshare.client.app.AppState
import ru.dndshare.client.data.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun HandbookScreen(
    state: AppState,
    format: LayoutFormat,
    fold: FoldInfo?,
    images: ImageLoader,
    heading: HandbookHeadingState,
    header: @Composable () -> Unit,
    status: @Composable () -> Unit,
) {
    val cache = state.repository?.cache ?: return
    key(state.sourceId, state.editionId) {
        var query by rememberSaveable { mutableStateOf("") }
        var typeId by rememberSaveable { mutableLongStateOf(0L) }
        var collection by rememberSaveable { mutableStateOf(false) }
        var dictionaryId by rememberSaveable { mutableLongStateOf(0L) }
        var history by rememberSaveable { mutableStateOf(listOf<Long>()) }
        var filtersJson by rememberSaveable { mutableStateOf("{}") }
        var bookIds by rememberSaveable { mutableStateOf(emptyList<Long>()) }
        var groupBy by rememberSaveable { mutableStateOf("") }
        var filterOpen by remember { mutableStateOf(false) }
        val focus = LocalFocusManager.current
        val keyboard = LocalSoftwareKeyboardController.current
        val selected = history.lastOrNull()
        val editionKey = if (state.editionId > 0) "%|${state.editionId}|%" else ""
        val metadata by
            produceState(HandbookMetadata(), state.sourceId) {
                cache.observeMetadata(state.sourceId).collect { row ->
                    value =
                        row?.let { WireJson.decodeFromString<HandbookMetadata>(it.payload) }
                            ?: HandbookMetadata()
                }
            }
        val counts by
            produceState<List<TypeCount>>(emptyList(), state.sourceId, editionKey) {
                cache.observeCounts(state.sourceId, editionKey).collect { value = it }
            }
        fun dismissInput() {
            focus.clearFocus()
            keyboard?.hide()
        }
        fun home() {
            dismissInput()
            collection = false
            dictionaryId = 0
            history = emptyList()
            query = ""
            typeId = 0
        }
        fun back() {
            dismissInput()
            if (history.isNotEmpty()) history = history.dropLast(1) else home()
        }
        fun open(id: Long) {
            dismissInput()
            if (id != selected) history = history + id
        }
        val pages = rememberSaveableStateHolder()
        val owner = remember { Any() }
        val active = LocalAppPageActive.current
        SideEffect {
            if (active)
                heading.publish(
                    owner,
                    metadata.types.firstOrNull { collection && it.id == typeId },
                    ::home,
                )
        }
        DisposableEffect(owner) { onDispose { heading.clear(owner) } }
        BackHandler(
            (selected != null || collection || dictionaryId > 0 || query.isNotBlank()) &&
                !LocalAppDrawerOpen.current &&
                active,
            ::back,
        )
        val type = metadata.types.firstOrNull { it.id == typeId }
        ShareChromeLayout(
            header = {
                Column {
                    header()
                    status()
                }
            },
            subheader = {
                Column {
                    if (
                        collection &&
                            dictionaryId == 0L &&
                            (selected == null || format != LayoutFormat.Phone)
                    ) {
                        HandbookControlsChrome(format, fold) {
                            HandbookListControls(
                                query,
                                { query = it },
                                groupBy,
                                { groupBy = it },
                                handbookGroupFields(type),
                                filtersJson != "{}" || bookIds.isNotEmpty(),
                                { filterOpen = true },
                                filterFields(type?.fields as? JsonArray ?: JsonArray(emptyList()))
                                    .isNotEmpty() || metadata.books.isNotEmpty(),
                            )
                        }
                    }
                }
            },
        ) {
            AnimatedHandbookPage(
                HandbookDestination(collection, typeId, dictionaryId, selected),
                format,
            ) { destination ->
                pages.SaveableStateProvider(destination.key(format)) {
                    when {
                        destination.dictionaryId > 0 && destination.itemId == null ->
                            HandbookDictionary(destination.dictionaryId, metadata, ::home, ::open)
                        !destination.collection && destination.itemId == null ->
                            HandbookLanding(
                                metadata,
                                counts,
                                images,
                                {
                                    dismissInput()
                                    typeId = it
                                    collection = true
                                    dictionaryId = 0
                                    history = emptyList()
                                    filtersJson = "{}"
                                    bookIds = emptyList()
                                    groupBy = ""
                                    query = ""
                                },
                                { dictionaryId = it },
                            )
                        else ->
                            HandbookCollectionPage(
                                cache,
                                state.sourceId,
                                editionKey,
                                destination,
                                format,
                                fold,
                                metadata,
                                images,
                                query,
                                groupBy,
                                filtersJson,
                                bookIds,
                                ::back,
                                ::open,
                            )
                    }
                }
            }
        }
        if (filterOpen)
            HandbookFilters(
                metadata.types.firstOrNull { it.id == typeId },
                metadata,
                WireJson.parseToJsonElement(filtersJson).jsonObject,
                bookIds,
                { filtersJson = it.toString() },
                { bookIds = it },
                { filterOpen = false },
            )
    }
}
