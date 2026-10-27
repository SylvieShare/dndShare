package ru.dndshare.client.ui

import ru.dndshare.client.ui.designsystem.*

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import ru.dndshare.client.app.AppState
import ru.dndshare.client.model.*

@Composable
fun CharacterScreen(state: AppState, format: LayoutFormat, images: ImageLoader, refresh: () -> Unit, open: (String) -> Unit) {
    val repository = state.repository ?: return
    var query by rememberSaveable { mutableStateOf("") }
    val characters by produceState<List<Character>?>(null, repository) {
        repository.cache.observeCharacters().collect { rows ->
            value = rows.map { WireJson.decodeFromString<Character>(it.payload) }
        }
    }
    Column(Modifier.fillMaxSize().padding(if (format == LayoutFormat.Phone) 16.dp else 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)) {
        OutlinedTextField(
            value = query, onValueChange = { query = it }, modifier = Modifier.fillMaxWidth(),
            singleLine = true, label = { Text("Найти персонажа") }, leadingIcon = { AppGlyph(Glyph.Search) },
        )
        if (state.characterError != null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(state.characterError, Modifier.weight(1f), color = MaterialTheme.colorScheme.error)
                TextButton(onClick = refresh) { Text("Повторить") }
            }
        }
        if (characters == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        } else {
            val visible = characters.orEmpty().filter { it.name.contains(query, ignoreCase = true) }
            if (visible.isEmpty()) EmptyContent(
                if (query.isNotBlank()) "Ничего не найдено" else "Персонажей пока нет",
                if (query.isNotBlank()) "Попробуйте другое имя." else "Здесь появятся персонажи вашего аккаунта.",
            ) else LazyVerticalGrid(
                columns = GridCells.Adaptive(if (format == LayoutFormat.Phone) 280.dp else 270.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                items(visible, key = { it.id }) { character ->
                    OutlinedCard(onClick = { open(character.uuid) }, modifier = Modifier.fillMaxWidth()) {
                        Row(Modifier.padding(18.dp), horizontalArrangement = Arrangement.spacedBy(16.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            if (character.iconImageUrl != null) AsyncImage(
                                model = character.iconImageUrl, imageLoader = images, contentDescription = null,
                                contentScale = ContentScale.Crop, modifier = Modifier.size(64.dp).clip(RoundedCornerShape(16.dp)),
                            ) else Surface(Modifier.size(64.dp), shape = RoundedCornerShape(16.dp),
                                color = MaterialTheme.colorScheme.primaryContainer) {
                                Box(contentAlignment = Alignment.Center) { Text(character.name.take(1), style = MaterialTheme.typography.headlineSmall) }
                            }
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(character.name, style = MaterialTheme.typography.titleMedium)
                                Text(character.subtitle, style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                                if (character.level != "—" && character.level.isNotBlank()) {
                                    Text("Уровень " + character.level, style = MaterialTheme.typography.labelMedium,
                                        color = MaterialTheme.colorScheme.primary)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun EmptyContent(title: String, description: String) {
    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge)
            Text(description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
