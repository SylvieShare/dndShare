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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import coil3.compose.LocalPlatformContext
import coil3.disk.DiskCache
import coil3.memory.MemoryCache
import coil3.network.ktor3.KtorNetworkFetcherFactory
import coil3.svg.SvgDecoder
import okio.Path.Companion.toPath
import ru.dndshare.client.R
import ru.dndshare.client.app.*
import ru.dndshare.client.ui.character.CharacterDestination
import ru.dndshare.client.ui.character.CharacterListSubheader
import ru.dndshare.client.ui.character.CharacterSheetRoute
import ru.dndshare.client.ui.creation.CharacterCreationRoute
import ru.dndshare.client.ui.designsystem.*
import ru.dndshare.client.ui.designsystem.ShareMorphRoot

@Composable
fun DndShareApp(controller: AppController, fold: FoldInfo? = null, onBackground: () -> Unit) {
    val state by controller.state.collectAsState()
    var creating by rememberSaveable { mutableStateOf(false) }
    var creationOwner by rememberSaveable { mutableLongStateOf(0) }
    var requestedCharacter by rememberSaveable { mutableStateOf<String?>(null) }
    val create = {
        creationOwner = state.user?.id ?: 0
        creating = true
    }
    // Register before detail handlers: they consume Back first, the signed-in root backgrounds the
    // task.
    BackHandler(enabled = !state.booting && state.user != null, onBack = onBackground)
    DndTheme {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            when {
                state.booting ->
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(20.dp),
                        ) {
                            Image(
                                painterResource(R.drawable.brand_mark),
                                null,
                                Modifier.size(72.dp),
                            )
                            CircularProgressIndicator()
                        }
                    }
                state.user == null -> LoginScreen(state, controller::login, create)
                else ->
                    key(state.user!!.id) {
                        AuthenticatedApp(
                            controller,
                            state,
                            fold,
                            create,
                            requestedCharacter,
                            { requestedCharacter = null },
                        )
                    }
            }
            if (creating)
                CharacterCreationRoute(
                    controller,
                    creationOwner,
                    { creating = false },
                    { uuid ->
                        requestedCharacter = uuid
                        creating = false
                    },
                )
            if (state.confirmLogout)
                ShareAlertDialog(
                    onDismissRequest = controller::cancelLogout,
                    title = { Text("Выйти и удалить несохранённые правки?") },
                    text = {
                        Text(
                            "На устройстве остались изменения, которые ещё не принял сервер. Можно отменить выход и дождаться сохранения."
                        )
                    },
                    confirmButton = {
                        ShareTextButton(onClick = { controller.confirmLogout() }) {
                            Text("Выйти и удалить")
                        }
                    },
                    dismissButton = {
                        ShareTextButton(onClick = controller::cancelLogout) { Text("Остаться") }
                    },
                )
        }
    }
}

@Composable
private fun AuthenticatedApp(
    controller: AppController,
    state: AppState,
    fold: FoldInfo?,
    create: () -> Unit,
    requestedCharacter: String?,
    consumedCharacter: () -> Unit,
) {
    var page by rememberSaveable { mutableStateOf(AppPage.Handbook.name) }
    val pages = rememberSaveableStateHolder()
    var characterHistory by
        key("character-history-v1") {
            rememberSaveable { mutableStateOf<List<String>>(emptyList()) }
        }
    val characterUuid = characterHistory.lastOrNull()
    LaunchedEffect(requestedCharacter) {
        requestedCharacter?.let {
            characterHistory = listOf(it)
            page = AppPage.Characters.name
            consumedCharacter()
        }
    }
    val handbookHeading = remember { HandbookHeadingState() }
    val focus = LocalFocusManager.current
    val keyboard = LocalSoftwareKeyboardController.current
    val context = LocalPlatformContext.current
    val images =
        remember(state.user!!.id) {
            ImageLoader.Builder(context)
                .components {
                    add(SvgDecoder.Factory())
                    add(KtorNetworkFetcherFactory(httpClient = { controller.api.client }))
                }
                .diskCache {
                    DiskCache.Builder()
                        .directory(controller.platform.mediaDirectory(state.user!!.id).toPath())
                        .maxSizeBytes(128L * 1024 * 1024)
                        .build()
                }
                .memoryCache { MemoryCache.Builder().maxSizeBytes(24L * 1024 * 1024).build() }
                .build()
        }
    DisposableEffect(images) {
        val unregister = controller.registerMediaCache { images.shutdown() }
        onDispose {
            unregister()
            images.shutdown()
        }
    }
    BoxWithConstraints(
        Modifier.fillMaxSize()
            .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Horizontal))
    ) {
        val format = layoutFormat(maxWidth.value)
        val selectedPage = runCatching { AppPage.valueOf(page) }.getOrDefault(AppPage.Handbook)
        ShareMorphRoot {
            CompositionLocalProvider(
                LocalHeaderConnection provides state.headerConnection(),
                LocalHeaderRetry provides { controller.refresh(force = true) },
            ) {
                pages.SaveableStateProvider("application-shell") {
                    AppNavigationShell(
                        format,
                        selectedPage,
                        state,
                        controller,
                        navigate = {
                            if (it == AppPage.CreateCharacter) create()
                            else {
                                focus.clearFocus()
                                keyboard?.hide()
                                characterHistory = emptyList()
                                page = it.name
                            }
                        },
                    ) { openMenu ->
                        CharacterDestination(characterUuid, characterHistory.size) {
                            displayedUuid,
                            active ->
                            if (displayedUuid != null)
                                pages.SaveableStateProvider("sheet:$displayedUuid") {
                                    CharacterSheetRoute(
                                        displayedUuid,
                                        state,
                                        format,
                                        images,
                                        active,
                                        close = { characterHistory = characterHistory.dropLast(1) },
                                        replace = {
                                            if (it != characterUuid)
                                                characterHistory = characterHistory + it
                                        },
                                        api = controller.api,
                                        icons = controller.inventoryIcons,
                                        backTitle =
                                            if (characterHistory.size > 1) "Назад" else "Персонажи",
                                    )
                                }
                            else {
                                AnimatedAppPage(selectedPage) { displayedPage ->
                                    pages.SaveableStateProvider(displayedPage.name) {
                                        val header: @Composable () -> Unit = {
                                            AppHeader(
                                                format,
                                                displayedPage,
                                                state,
                                                openMenu,
                                                retry = { controller.refresh(force = true) },
                                                heading =
                                                    if (displayedPage == AppPage.Handbook)
                                                        ({
                                                            HandbookHeading(
                                                                handbookHeading.type,
                                                                images,
                                                                handbookHeading::goHome,
                                                            )
                                                        })
                                                    else null,
                                            )
                                        }
                                        if (displayedPage == AppPage.Handbook) {
                                            HandbookScreen(
                                                state,
                                                format,
                                                fold,
                                                images,
                                                handbookHeading,
                                                header,
                                            )
                                        } else
                                            ShareChromeLayout(
                                                header = header,
                                                subheader = {
                                                    Column {
                                                        if (displayedPage == AppPage.Characters)
                                                            CharacterListSubheader(create)
                                                    }
                                                },
                                            ) { padding ->
                                                if (displayedPage == AppPage.Characters)
                                                    CharacterScreen(
                                                        state,
                                                        format,
                                                        images,
                                                        controller.api,
                                                        refresh = {
                                                            controller.refresh(force = true)
                                                        },
                                                        contentPadding = padding,
                                                        open = { characterHistory = listOf(it) },
                                                    )
                                                else
                                                    Box(Modifier.fillMaxSize().padding(padding)) {
                                                        PlaceholderScreen(displayedPage)
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
    }
}
