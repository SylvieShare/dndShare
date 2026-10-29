package ru.dndshare.client.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.ImageLoader
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import ru.dndshare.client.app.AppState
import ru.dndshare.client.model.*
import ru.dndshare.client.network.*
import ru.dndshare.client.ui.character.CharacterListCard
import ru.dndshare.client.ui.designsystem.*

@Composable
fun CharacterScreen(
    state: AppState,
    format: LayoutFormat,
    images: ImageLoader,
    api: ApiClient,
    refresh: () -> Unit,
    contentPadding: PaddingValues = PaddingValues(),
    open: (String) -> Unit,
) {
    val repository = state.repository ?: return
    var query by rememberSaveable { mutableStateOf("") }
    var deleting by remember { mutableStateOf<Character?>(null) }
    var refreshing by remember { mutableStateOf(true) }
    var busy by remember { mutableStateOf(false) }
    var failure by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(repository) {
        refreshing = true
        try {
            repository.refreshCharacters()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            failure = error.message ?: "Не удалось обновить список персонажей."
        } finally {
            refreshing = false
        }
    }
    fun action(block: suspend () -> Unit) {
        if (busy) return
        busy = true
        failure = null
        scope.launch {
            try {
                block()
                repository.refreshCharacters()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                failure = error.message ?: "Не удалось выполнить действие. Повторите попытку."
            } finally {
                busy = false
            }
        }
    }
    val characters by
        produceState<List<Character>?>(null, repository) {
            repository.cache
                .observeCharacters()
                .map { rows ->
                    rows
                        .map { WireJson.decodeFromString<Character>(it.payload) }
                        .sortedByDescending { it.changedAt }
                }
                .flowOn(Dispatchers.Default)
                .collect { value = it }
        }
    val errorMessage = failure ?: state.characterError
    val visible = characters.orEmpty().filter { it.name.contains(query, true) }
    Box(Modifier.fillMaxSize().shareCanvas(), contentAlignment = Alignment.TopCenter) {
        LazyVerticalGrid(
            columns = GridCells.Adaptive(if (format == LayoutFormat.Phone) 280.dp else 400.dp),
            modifier = Modifier.widthIn(max = DesignTokens.Layout.ContentMax).fillMaxSize(),
            contentPadding =
                PaddingValues(
                    start = if (format == LayoutFormat.Phone) 12.dp else DesignTokens.Spacing.Page,
                    end = if (format == LayoutFormat.Phone) 12.dp else DesignTokens.Spacing.Page,
                    top =
                        contentPadding.calculateTopPadding() +
                            if (format == LayoutFormat.Phone) 16.dp else 20.dp,
                    bottom = 20.dp,
                ),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item(key = "character-search", span = { GridItemSpan(maxLineSpan) }) {
                ShareSearch(query, { query = it }, placeholder = "Найти персонажа")
            }
            errorMessage?.let { message ->
                item(key = "character-error", span = { GridItemSpan(maxLineSpan) }) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(message, Modifier.weight(1f), color = WebPalette.Danger)
                        ShareTextButton(
                            onClick = {
                                failure = null
                                refresh()
                            },
                            enabled = !busy,
                        ) {
                            Text("Повторить")
                        }
                    }
                }
            }
            if (busy)
                item(key = "character-action", span = { GridItemSpan(maxLineSpan) }) {
                    LinearProgressIndicator(Modifier.fillMaxWidth())
                }
            if (
                characters == null ||
                    (characters.isNullOrEmpty() && (refreshing || state.synchronizing))
            )
                items(3, key = { "loading:$it" }) {
                    ru.dndshare.client.ui.character.CharacterListSkeleton()
                }
            else if (visible.isEmpty() && errorMessage == null)
                item(key = "empty", span = { GridItemSpan(maxLineSpan) }) {
                    EmptyContent(
                        if (query.isBlank()) "Персонажей пока нет" else "Ничего не найдено",
                        if (query.isBlank()) "Создайте первого персонажа."
                        else "Попробуйте другое имя.",
                    )
                }
            else {
                visible
                    .groupBy { it.sourceId }
                    .entries
                    .sortedWith(compareBy({ it.key == null }, { it.value.first().sourceName }))
                    .forEach { group ->
                        item(
                            key = "source:${group.key}",
                            span = { GridItemSpan(maxLineSpan) },
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(9.dp),
                            ) {
                                Text(
                                    group.value.first().sourceName ?: "Без системы",
                                    style =
                                        ShareTypography.header.copy(
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.Bold,
                                        ),
                                    color = WebPalette.TextSecondary,
                                )
                                ShareBadge(group.value.size.toString())
                            }
                        }
                        items(group.value, key = { it.uuid }) { character ->
                            CharacterListCard(
                                character,
                                images,
                                busy,
                                { open(character.uuid) },
                                clone = { action { api.cloneCharacter(character.uuid) } },
                                delete = { deleting = character },
                            )
                        }
                    }
            }
        }
    }

    deleting?.let { character ->
        ShareAlertDialog(
            onDismissRequest = { if (!busy) deleting = null },
            title = { Text("Удалить персонажа?") },
            text = { Text(character.name) },
            confirmButton = {
                ShareTextButton(
                    onClick = {
                        deleting = null
                        action { api.deleteCharacter(character.uuid) }
                    },
                    enabled = !busy,
                ) {
                    Text("Удалить", color = WebPalette.Danger)
                }
            },
            dismissButton = { ShareTextButton(onClick = { deleting = null }) { Text("Отмена") } },
        )
    }
}

@Composable
fun EmptyContent(title: String, description: String) {
    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(title, style = MaterialTheme.typography.titleLarge)
            Text(
                description,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
