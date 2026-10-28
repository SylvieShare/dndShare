package ru.dndshare.client.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.ImageLoader
import kotlinx.coroutines.CancellationException
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
    create: () -> Unit,
    open: (String) -> Unit,
) {
    val repository = state.repository ?: return
    var query by rememberSaveable { mutableStateOf("") }
    var deleting by remember { mutableStateOf<Character?>(null) }
    var busy by remember { mutableStateOf(false) }
    var failure by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(repository) {
        try {
            repository.refreshCharacters()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            failure = error.message ?: "Не удалось обновить список персонажей."
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
            repository.cache.observeCharacters().collect { rows ->
                value =
                    rows
                        .map { WireJson.decodeFromString<Character>(it.payload) }
                        .sortedByDescending { it.changedAt }
            }
        }
    Box(Modifier.fillMaxSize().shareCanvas(), contentAlignment = Alignment.TopCenter) {
        Column(
            Modifier.widthIn(max = DesignTokens.Layout.ContentMax)
                .fillMaxSize()
                .padding(if (format == LayoutFormat.Phone) 12.dp else 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Персонажи",
                    Modifier.weight(1f),
                    style =
                        ShareTypography.header.copy(
                            fontSize = 22.sp,
                            lineHeight = 28.sp,
                            fontWeight = FontWeight.Bold,
                        ),
                )
                Button(
                    onClick = create,
                    colors =
                        ButtonDefaults.buttonColors(
                            containerColor = WebPalette.Accent,
                            contentColor = WebPalette.OnAccent,
                        ),
                    modifier =
                        Modifier.heightIn(min = 34.dp).semantics {
                            contentDescription = "Новый персонаж"
                        },
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(9.dp),
                    contentPadding = PaddingValues(horizontal = 13.dp, vertical = 6.dp),
                ) {
                    Text("+", fontSize = 18.sp)
                    Spacer(Modifier.width(7.dp))
                    Text("Новый персонаж", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
            ShareSearch(query, { query = it }, placeholder = "Найти персонажа")
            (failure ?: state.characterError)?.let { message ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(message, Modifier.weight(1f), color = WebPalette.Danger)
                    TextButton(
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
            if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            if (characters == null)
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            else {
                val visible = characters.orEmpty().filter { it.name.contains(query, true) }
                if (visible.isEmpty())
                    EmptyContent(
                        if (query.isBlank()) "Персонажей пока нет" else "Ничего не найдено",
                        if (query.isBlank()) "Создайте первого персонажа."
                        else "Попробуйте другое имя.",
                    )
                else
                    LazyVerticalGrid(
                        columns =
                            GridCells.Adaptive(
                                if (format == LayoutFormat.Phone) 280.dp else 400.dp
                            ),
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        visible
                            .groupBy { it.sourceId }
                            .entries
                            .sortedWith(
                                compareBy({ it.key == null }, { it.value.first().sourceName })
                            )
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
    }
    deleting?.let { character ->
        AlertDialog(
            onDismissRequest = { if (!busy) deleting = null },
            title = { Text("Удалить персонажа?") },
            text = { Text(character.name) },
            confirmButton = {
                TextButton(
                    onClick = {
                        deleting = null
                        action { api.deleteCharacter(character.uuid) }
                    },
                    enabled = !busy,
                ) {
                    Text("Удалить", color = WebPalette.Danger)
                }
            },
            dismissButton = { TextButton(onClick = { deleting = null }) { Text("Отмена") } },
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
