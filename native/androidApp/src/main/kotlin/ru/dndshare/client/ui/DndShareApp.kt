package ru.dndshare.client.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import coil3.compose.LocalPlatformContext
import coil3.disk.DiskCache
import coil3.memory.MemoryCache
import coil3.network.ktor3.KtorNetworkFetcherFactory
import okio.Path.Companion.toPath
import androidx.compose.ui.res.painterResource
import ru.dndshare.client.app.*
import ru.dndshare.client.R

@Composable
fun DndShareApp(controller: AppController, fold: FoldInfo? = null, onBackground: () -> Unit) {
    val state by controller.state.collectAsState()
    // Register before detail handlers: they consume Back first, the signed-in root backgrounds the task.
    BackHandler(enabled = !state.booting && state.user != null, onBack = onBackground)
    DndTheme {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            when {
                state.booting -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(20.dp)) {
                        Image(painterResource(R.drawable.brand_mark), null, Modifier.size(72.dp))
                        CircularProgressIndicator()
                    }
                }
                state.user == null -> LoginScreen(state, controller::login)
                else -> key(state.user!!.id) { AuthenticatedApp(controller, state, fold) }
            }
        }
    }
}

@Composable
private fun AuthenticatedApp(controller: AppController, state: AppState, fold: FoldInfo?) {
    var page by rememberSaveable { mutableStateOf("handbook") }
    val pages = rememberSaveableStateHolder()
    val context = LocalPlatformContext.current
    val images = remember(state.user!!.id) {
        ImageLoader.Builder(context).components {
            add(KtorNetworkFetcherFactory(httpClient = { controller.api.client }))
        }.diskCache {
            DiskCache.Builder().directory(controller.platform.mediaDirectory(state.user!!.id).toPath())
                .maxSizeBytes(128L * 1024 * 1024).build()
        }.memoryCache { MemoryCache.Builder().maxSizeBytes(24L * 1024 * 1024).build() }.build()
    }
    DisposableEffect(images) {
        val unregister = controller.registerMediaCache { images.shutdown() }
        onDispose { unregister(); images.shutdown() }
    }
    BoxWithConstraints(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
        val format = layoutFormat(maxWidth.value)
        Row(Modifier.fillMaxSize()) {
            if (format != LayoutFormat.Phone) {
                AppNavigation(format, page) { page = it }
                VerticalDivider()
            }
            Scaffold(
                modifier = Modifier.weight(1f),
                containerColor = MaterialTheme.colorScheme.background,
                contentWindowInsets = WindowInsets(0, 0, 0, 0),
                topBar = { AppHeader(format, page, state, controller) },
                bottomBar = {
                    if (format == LayoutFormat.Phone) NavigationBar {
                        for ((key, label, icon) in destinations) NavigationBarItem(
                            selected = page == key, onClick = { page = key },
                            icon = { AppGlyph(icon) }, label = { Text(label) },
                        )
                    }
                },
            ) { padding ->
                Column(Modifier.fillMaxSize().padding(padding)) {
                    ConnectionStatus(state) { controller.refresh(force = true) }
                    pages.SaveableStateProvider(page) {
                        if (page == "characters") CharacterScreen(state, format, images) { controller.refresh(force = true) }
                        else HandbookScreen(state, format, fold, images) { controller.refresh(force = true) }
                    }
                }
            }
        }
    }
}

private data class Destination(val key: String, val label: String, val icon: Glyph)
private val destinations = listOf(
    Destination("handbook", "Справочник", Glyph.Book),
    Destination("characters", "Персонажи", Glyph.Characters),
)

@Composable
private fun AppNavigation(format: LayoutFormat, page: String, navigate: (String) -> Unit) {
    Surface(Modifier.width(if (format == LayoutFormat.Wide) 224.dp else 80.dp).fillMaxHeight()) {
        Column(Modifier.padding(horizontal = 12.dp, vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Image(painterResource(R.drawable.brand_mark), null, Modifier.size(52.dp))
                if (format == LayoutFormat.Wide) Text("DnD Share", style = MaterialTheme.typography.titleLarge)
            }
            Spacer(Modifier.height(20.dp))
            for (destination in destinations) {
                if (format == LayoutFormat.Wide) NavigationDrawerItem(
                    label = { Text(destination.label) },
                    selected = page == destination.key, onClick = { navigate(destination.key) },
                    icon = { AppGlyph(destination.icon) },
                ) else NavigationRailItem(
                    selected = page == destination.key, onClick = { navigate(destination.key) },
                    icon = { AppGlyph(destination.icon) },
                    modifier = Modifier.semantics { contentDescription = destination.label },
                )
            }
            Spacer(Modifier.weight(1f))
            if (format == LayoutFormat.Wide) Text("Место для вашей истории",
                Modifier.padding(12.dp), style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun AppHeader(format: LayoutFormat, page: String, state: AppState, controller: AppController) {
    var accountMenu by remember { mutableStateOf(false) }
    Surface {
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (format == LayoutFormat.Phone) Image(
                    painterResource(R.drawable.brand_mark), null, Modifier.padding(end = 8.dp).size(34.dp))
                Text(if (page == "handbook") "Справочник" else "Персонажи",
                    Modifier.weight(1f), style = MaterialTheme.typography.titleLarge)
                if (format != LayoutFormat.Phone) SourcePicker(state, controller)
                IconButton(onClick = { controller.refresh(force = true) }, enabled = !state.synchronizing,
                    modifier = Modifier.semantics { contentDescription = "Обновить" }) { AppGlyph(Glyph.Refresh) }
                Box {
                    FilledTonalIconButton(onClick = { accountMenu = true },
                        modifier = Modifier.semantics { contentDescription = "Аккаунт" }) {
                        Text(state.user?.login?.take(1)?.uppercase().orEmpty())
                    }
                    DropdownMenu(expanded = accountMenu, onDismissRequest = { accountMenu = false }) {
                        DropdownMenuItem(text = { Text(state.user?.login.orEmpty()) }, onClick = {}, enabled = false)
                        HorizontalDivider()
                        DropdownMenuItem(text = { Text("Выйти") }, leadingIcon = { AppGlyph(Glyph.Exit) },
                            onClick = { accountMenu = false; controller.logout() })
                    }
                }
            }
            if (format == LayoutFormat.Phone) SourcePicker(state, controller)
        }
    }
}

@Composable
private fun SourcePicker(state: AppState, controller: AppController) {
    var expanded by remember { mutableStateOf(false) }
    val source = state.sources.firstOrNull { it.id == state.sourceId }
    val edition = source?.versions?.firstOrNull { it.id == state.editionId }
    Box {
        TextButton(onClick = { expanded = true }, enabled = state.sources.isNotEmpty()) {
            Text(listOfNotNull(source?.name, edition?.version).joinToString(" · ").ifEmpty { "Игровая система" },
                maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("  ⌄")
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            for (item in state.sources) {
                if (item.versions.isEmpty()) DropdownMenuItem(
                    text = { Text(item.name) },
                    onClick = { expanded = false; controller.selectSource(item, null) },
                )
                for (version in item.versions) DropdownMenuItem(
                    text = { Text(item.name + " · " + version.version) },
                    onClick = { expanded = false; controller.selectSource(item, version) },
                )
            }
        }
    }
}

@Composable
private fun ConnectionStatus(state: AppState, retry: () -> Unit) {
    if (state.synchronizing) {
        LinearProgressIndicator(Modifier.fillMaxWidth())
        Text(if (state.received > 0) "Синхронизация · получено " + state.received
            else "Обновляем данные…", Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
            style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    if (state.error != null) Surface(color = MaterialTheme.colorScheme.errorContainer) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(state.error, Modifier.weight(1f), style = MaterialTheme.typography.bodySmall)
            TextButton(onClick = retry, enabled = !state.synchronizing) { Text("Повторить") }
        }
    }
}
