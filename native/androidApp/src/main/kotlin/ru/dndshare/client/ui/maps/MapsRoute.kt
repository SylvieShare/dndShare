package ru.dndshare.client.ui.maps

import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.platform.LocalContext
import coil3.ImageLoader
import java.io.File
import java.util.UUID
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.MapAssetCache
import ru.dndshare.client.maps.rendering.MapSnapshotQueue
import ru.dndshare.client.network.ApiClient
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.client.ui.designsystem.ShareChromeLayout

@Composable
internal fun MapsRoute(
    client: ApiClient,
    owner: Long,
    images: ImageLoader,
    format: LayoutFormat,
    header: @Composable () -> Unit,
    fullscreen: (Boolean) -> Unit,
    admin: Boolean = false,
) {
    var editor by rememberSaveable(owner) { mutableStateOf<String?>(null) }
    val context = LocalContext.current.applicationContext
    val api = remember(client) { HttpMapsApi(client) }
    val root =
        remember(client, owner) {
            File(
                context.filesDir,
                "maps/${UUID.nameUUIDFromBytes(client.baseUrl.toByteArray())}/$owner",
            )
        }
    val store = remember(root) { MapWorkspaceStore(File(root, "workspace")) }
    val assets = remember(root, api) { MapAssetCache(File(root, "models"), api) }
    val snapshots = remember(assets) { MapSnapshotQueue(context, assets) }
    val previews = remember(api, snapshots) { MapStoredPreviews(api, snapshots) }
    DisposableEffect(snapshots) { onDispose { snapshots.close() } }
    val notify by rememberUpdatedState(fullscreen)
    LaunchedEffect(editor) { notify(editor != null) }
    DisposableEffect(Unit) { onDispose { notify(false) } }
    if (editor != null)
        MapEditorScreen(
            requireNotNull(editor),
            api,
            store,
            assets,
            images,
            format,
            close = { editor = null },
            replace = { editor = it },
            admin = admin,
            snapshots = snapshots,
            previews = previews,
        )
    else
        ShareChromeLayout(header = header) { padding ->
            MapLibraryScreen(
                api,
                store,
                images,
                padding,
                open = { editor = it },
                cache = assets,
                previews = previews,
            )
        }
}
