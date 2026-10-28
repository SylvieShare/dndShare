package ru.dndshare.client.ui.character

import androidx.compose.runtime.*
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.viewmodel.compose.rememberViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import coil3.ImageLoader
import kotlinx.coroutines.*
import ru.dndshare.client.app.AppState
import ru.dndshare.client.ui.LayoutFormat

@Composable
fun CharacterSheetRoute(
    uuid: String,
    state: AppState,
    format: LayoutFormat,
    images: ImageLoader,
    active: Boolean,
    close: () -> Unit,
    replace: (String) -> Unit = { close() },
    api: ru.dndshare.client.network.ApiClient? = null,
    backTitle: String = "Персонажи",
    icons: ru.dndshare.client.character.InventoryIconCache? = null,
) {
    val repository = state.repository ?: return
    val accountId = state.user?.id ?: return
    key(accountId, uuid) {
        val owner = rememberViewModelStoreOwner()
        val factory =
            remember(repository, uuid) {
                viewModelFactory {
                    initializer {
                        CharacterSheetViewModel(
                            uuid,
                            accountId,
                            state.sourceId,
                            repository.sheets,
                            repository.cache,
                            repository.database.characterSheets(),
                            SheetServices(
                                { source -> repository.synchronize(source) {} },
                                { repository.refreshCharacterJournal(uuid) },
                                api,
                                state.sources,
                                icons,
                            ),
                            createSavedStateHandle(),
                            repository.commandQueue(uuid),
                        )
                    }
                }
            }
        val model: CharacterSheetViewModel =
            viewModel(owner, key = "$accountId:$uuid", factory = factory)
        val ui by model.uiState.collectAsStateWithLifecycle()
        val lifecycle = LocalLifecycleOwner.current.lifecycle
        LaunchedEffect(model, active, lifecycle) {
            if (active)
                lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
                    var interval = 5_000L
                    while (isActive) {
                        delay(interval)
                        try {
                            model.poll()
                            interval = 5_000L
                        } catch (cancelled: CancellationException) {
                            throw cancelled
                        } catch (_: Exception) {
                            interval = (interval * 2).coerceAtMost(60_000)
                        }
                    }
                }
        }
        LaunchedEffect(ui.remote.destination, ui.remote.deleted) {
            if (ui.remote.deleted) close() else ui.remote.destination?.let(replace)
        }
        CharacterSheetScreen(
            ui,
            model,
            accountId,
            repository.cache,
            format,
            images,
            active,
            close,
            backTitle,
        )
    }
}
