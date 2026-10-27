package ru.dndshare.client.ui.character

import androidx.compose.runtime.*
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.rememberViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import coil3.ImageLoader
import ru.dndshare.client.app.AppState
import ru.dndshare.client.ui.LayoutFormat

@Composable
fun CharacterSheetRoute(uuid: String, state: AppState, format: LayoutFormat, images: ImageLoader, active: Boolean, close: () -> Unit) {
    val repository = state.repository ?: return
    val accountId = state.user?.id ?: return
    key(accountId, uuid) {
        val owner = rememberViewModelStoreOwner()
        val factory = remember(repository, uuid) { viewModelFactory { initializer {
            CharacterSheetViewModel(uuid, accountId, state.sourceId, repository.sheets,
                repository.cache, repository.database.characterSheets(),
                SheetServices({ source -> repository.synchronize(source) { } }, { repository.refreshCharacterJournal(uuid) }),
                createSavedStateHandle())
        } } }
        val model: CharacterSheetViewModel = viewModel(owner, key = "$accountId:$uuid", factory = factory)
        val ui by model.uiState.collectAsStateWithLifecycle()
        CharacterSheetScreen(ui, model, accountId, repository.cache, format, images, active, close)
    }
}
