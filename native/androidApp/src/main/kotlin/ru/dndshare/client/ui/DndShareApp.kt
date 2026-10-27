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
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import coil3.compose.LocalPlatformContext
import coil3.svg.SvgDecoder
import coil3.disk.DiskCache
import coil3.memory.MemoryCache
import coil3.network.ktor3.KtorNetworkFetcherFactory
import okio.Path.Companion.toPath
import androidx.compose.ui.res.painterResource
import ru.dndshare.client.app.*
import ru.dndshare.client.R
import ru.dndshare.client.ui.character.CharacterDestination
import ru.dndshare.client.ui.character.CharacterSheetScreen

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
            if (state.confirmLogout) AlertDialog(onDismissRequest = controller::cancelLogout,
                title = { Text("Выйти и удалить несохранённые правки?") },
                text = { Text("На устройстве остались изменения, которые ещё не принял сервер. Можно отменить выход и дождаться сохранения.") },
                confirmButton = { TextButton(onClick = { controller.confirmLogout() }) { Text("Выйти и удалить") } },
                dismissButton = { TextButton(onClick = controller::cancelLogout) { Text("Остаться") } })
        }
    }
}

@Composable
private fun AuthenticatedApp(controller: AppController, state: AppState, fold: FoldInfo?) {
    var page by rememberSaveable { mutableStateOf(AppPage.Handbook.name) }
    val pages = rememberSaveableStateHolder()
    var characterUuid by rememberSaveable { mutableStateOf<String?>(null) }
    val handbookHeading = remember { HandbookHeadingState() }
    val focus = LocalFocusManager.current
    val keyboard = LocalSoftwareKeyboardController.current
    val context = LocalPlatformContext.current
    val images = remember(state.user!!.id) {
        ImageLoader.Builder(context).components {
            add(SvgDecoder.Factory())
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
        val selectedPage = runCatching { AppPage.valueOf(page) }.getOrDefault(AppPage.Handbook)
        CharacterDestination(characterUuid) { displayedUuid, active ->
            if (displayedUuid != null) pages.SaveableStateProvider("sheet:$displayedUuid") {
                CharacterSheetScreen(displayedUuid, state, format, images, active, close = { characterUuid = null })
            } else pages.SaveableStateProvider("application-shell") {
        AppNavigationShell(format, selectedPage, state, controller, navigate = {
            if (it != selectedPage) {
                focus.clearFocus()
                keyboard?.hide()
                page = it.name
            }
        }) { openMenu ->
            Scaffold(
                containerColor = MaterialTheme.colorScheme.background,
                contentWindowInsets = WindowInsets(0, 0, 0, 0),
                topBar = { AppHeader(format, selectedPage, state, openMenu,
                    heading = if (selectedPage == AppPage.Handbook) ({
                        HandbookHeading(handbookHeading.type, images, handbookHeading::goHome)
                    }) else null) },
            ) { padding ->
                Column(Modifier.fillMaxSize().padding(padding)) {
                    ConnectionStatus(state) { controller.refresh(force = true) }
                    AnimatedAppPage(selectedPage) { displayedPage ->
                        pages.SaveableStateProvider(displayedPage.name) {
                            when (displayedPage) {
                                AppPage.Characters -> CharacterScreen(state, format, images, refresh = { controller.refresh(force = true) }, open = { characterUuid = it })
                                AppPage.Handbook -> HandbookScreen(state, format, fold, images, handbookHeading)
                                else -> PlaceholderScreen(displayedPage)
                            }
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
