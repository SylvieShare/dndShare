package ru.dndshare.client.ui.creation

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.rememberViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import coil3.ImageLoader
import coil3.network.ktor3.KtorNetworkFetcherFactory
import coil3.svg.SvgDecoder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.jsonObject
import ru.dndshare.client.app.AppController
import ru.dndshare.client.model.WireJson
import ru.dndshare.client.ui.LoginScreen
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun CharacterCreationRoute(
    app: AppController,
    ownerId: Long,
    close: () -> Unit,
    created: (String) -> Unit,
) {
    val context = LocalContext.current
    val owner = rememberViewModelStoreOwner()
    val factory =
        remember(app, ownerId) {
            viewModelFactory {
                initializer {
                    CharacterCreationViewModel(app, ownerId) {
                        withContext(Dispatchers.IO) {
                            context.assets.open("rules/creation-data.json").bufferedReader().use {
                                WireJson.parseToJsonElement(it.readText()).jsonObject
                            }
                        }
                    }
                }
            }
        }
    val model: CharacterCreationViewModel =
        viewModel(owner, key = "creation:$ownerId", factory = factory)
    val ui by model.state.collectAsStateWithLifecycle()
    val account by app.state.collectAsStateWithLifecycle()
    val images =
        remember(app) {
            ImageLoader.Builder(context)
                .components {
                    add(SvgDecoder.Factory())
                    add(KtorNetworkFetcherFactory(httpClient = { app.api.client }))
                }
                .diskCache(null)
                .build()
        }
    DisposableEffect(images) { onDispose { images.shutdown() } }
    LaunchedEffect(ui.created) { ui.created?.let(created) }
    LaunchedEffect(ui.needsAuth, account.user?.id) {
        if (ui.needsAuth && account.user != null) model.create(ui.partialAfterAuth)
    }
    ShareFullscreenDialog(
        onDismissRequest = { if (!ui.busy) close() },
        properties = DialogProperties(usePlatformDefaultWidth = false, dismissOnBackPress = false),
    ) {
        Surface(Modifier.fillMaxSize(), color = WebPalette.Background) {
            if (ui.needsAuth && account.user == null) {
                BackHandler { model.cancelAuth() }
                Column {
                    ShareTextButton(
                        onClick = model::cancelAuth,
                        modifier = Modifier.padding(12.dp),
                    ) {
                        Text("К черновику персонажа")
                    }
                    Box(Modifier.weight(1f)) { LoginScreen(account, app::login) }
                }
            } else CharacterCreationScreen(ui, model, images, close)
        }
    }
}
