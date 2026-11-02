package ru.dndshare.client.ui.maps

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapEditorScreen(
    id: String,
    api: MapsApi,
    store: MapWorkspaceStore,
    cache: MapAssetCache,
    images: ImageLoader,
    format: LayoutFormat,
    close: () -> Unit,
    replace: (String) -> Unit = { close() },
) {
    val controller = remember(id) { MapEditorController(api, store) }
    val state by controller.state.collectAsState()
    val scope = rememberCoroutineScope()
    val inputs = remember { ShareFormInputs() }
    var selected by rememberSaveable(id) { mutableStateOf<List<String>>(emptyList()) }
    var tab by
        rememberSaveable(id) { mutableStateOf(if (format == LayoutFormat.Wide) "tiles" else "") }
    var placement by remember { mutableStateOf<MapModel?>(null) }
    var rotation by rememberSaveable(id) { mutableIntStateOf(0) }
    var level by rememberSaveable(id) { mutableIntStateOf(0) }
    var orbit by rememberSaveable(id) { mutableStateOf(false) }
    var multiple by rememberSaveable(id) { mutableStateOf(false) }
    var scene by remember { mutableStateOf<FilamentMapScene?>(null) }
    var modelPending by remember { mutableIntStateOf(0) }
    var rendererError by remember { mutableStateOf<String?>(null) }
    var leaving by remember { mutableStateOf(false) }
    var confirmLeave by remember { mutableStateOf(false) }
    val dragging = remember(id) { MapTileDrag() }
    val map = state.map
    fun back() {
        inputs.flush()
        when {
            dragging.preview != null -> dragging.cancel()
            placement != null -> placement = null
            selected.isNotEmpty() -> selected = emptyList()
            tab.isNotEmpty() -> tab = ""
            !leaving -> {
                leaving = true
                scope.launch {
                    if (controller.flush()) close() else confirmLeave = true
                    leaving = false
                }
            }
        }
    }
    LaunchedEffect(id) { controller.open(id) }
    DisposableEffect(controller) {
        onDispose {
            inputs.flush()
            controller.close()
        }
    }
    BackHandler(onBack = ::back)
    CompositionLocalProvider(LocalShareFormInputs provides inputs) {
        Column(Modifier.fillMaxSize().background(WebPalette.Background).imePadding()) {
            Box(
                Modifier.windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top))
            ) {
                ShareWorkspaceHeader(
                    contentInset = 12.dp,
                    maxContentWidth = 5000.dp,
                    actions = {
                        if (state.saving) Text("Сохраняем…", style = ShareTypography.context)
                        else if (state.work?.dirty == true)
                            Text(
                                "Есть правки",
                                style = ShareTypography.context,
                                color = WebPalette.AccentSoft,
                            )
                        MapToolButton(
                            "Отменить",
                            Glyph.Undo,
                            state.work?.undo?.isNotEmpty() == true &&
                                map?.editable == true &&
                                !state.conflict,
                            controller::undo,
                        )
                        MapToolButton(
                            "Повторить",
                            Glyph.Redo,
                            state.work?.redo?.isNotEmpty() == true &&
                                map?.editable == true &&
                                !state.conflict,
                            controller::redo,
                        )
                    },
                ) {
                    MapToolButton("К картам", Glyph.Back, !leaving) {
                        selected = emptyList()
                        tab = ""
                        placement = null
                        back()
                    }
                    Column(Modifier.weight(1f)) {
                        Text(
                            map?.name ?: "Редактор карты",
                            maxLines = 1,
                            style = ShareTypography.header,
                        )
                        if (map?.publishedAt != null)
                            Text(
                                "Опубликованная карта · ${map.author}",
                                style = ShareTypography.context,
                            )
                    }
                }
            }
            if (state.error != null || rendererError != null)
                Row(
                    Modifier.fillMaxWidth().background(WebPalette.Subheader).padding(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        state.error ?: rendererError.orEmpty(),
                        Modifier.weight(1f),
                        color = WebPalette.Danger,
                        style = ShareTypography.context,
                    )
                    ShareTextButton({
                        rendererError = null
                        scene?.retry()
                        if (state.work == null) controller.open(id) else controller.retry()
                    }) {
                        Text("Повторить")
                    }
                }
            if (state.conflict)
                Row(Modifier.padding(8.dp)) {
                    Text(
                        "Сервер не принял правки этой карты. Можно сохранить локальную копию.",
                        Modifier.weight(1f),
                        style = ShareTypography.context,
                    )
                    ShareTextButton({ confirmLeave = true }) { Text("Действия") }
                }
            if (map == null || (state.modelLoading && state.models.isEmpty())) {
                if (map == null && !state.loading)
                    Column(
                        Modifier.fillMaxSize().padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement =
                            Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
                    ) {
                        Text("Не удалось открыть карту", style = ShareTypography.header)
                        ShareButton({ controller.open(id) }) { Text("Повторить загрузку") }
                    }
                else
                    Column(
                        Modifier.fillMaxSize().padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        ShareSkeletonBlock(Modifier.fillMaxWidth(.45f), 48.dp)
                        ShareSkeletonBlock(Modifier.fillMaxSize(), 240.dp)
                    }
            } else
                BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
                    val models = state.models.associateBy { it.uuid }
                    val selectedIds = selected.toSet()
                    val panelWidth = 350.dp.coerceAtMost(maxWidth - 77.dp)
                    val inspectorHeight = maxHeight - 24.dp
                    Row(Modifier.fillMaxSize()) {
                        if (map.editable)
                            MapToolRail(
                                tab,
                                {
                                    tab = if (tab == it) "" else it
                                    placement = null
                                },
                                Modifier.width(77.dp),
                            )
                        Box(Modifier.weight(1f).fillMaxHeight()) {
                            MapSceneView(
                                dragging.preview ?: map.document,
                                state.models,
                                cache,
                                selectedIds,
                                orbit,
                                tap = { hit, point ->
                                    val model = placement
                                    if (model != null && map.editable) {
                                        controller.document { doc ->
                                            if (model.isObject)
                                                mapPlaceObject(doc, model, models, point, rotation)
                                            else mapPlaceTile(doc, model, point, rotation, level)
                                        }
                                        placement = null
                                    } else
                                        selected =
                                            if (!multiple) listOfNotNull(hit)
                                            else if (hit == null) selected
                                            else if (hit in selected) selected - hit
                                            else selected + hit
                                },
                                drag = { hit, point, end ->
                                    if (map.editable)
                                        dragging.move(
                                            map.document,
                                            models,
                                            hit,
                                            point,
                                            end,
                                            selected.toSet(),
                                            { selected = it.toList() },
                                            controller::document,
                                        )
                                },
                                cancel = dragging::cancel,
                                renderer = { scene = it },
                                status = { pending, error ->
                                    modelPending = pending
                                    if (error != null) rendererError = error
                                },
                            )
                            Column(
                                Modifier.align(Alignment.BottomStart)
                                    .padding(12.dp)
                                    .windowInsetsPadding(
                                        WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom)
                                    ),
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                Surface(
                                    color = WebPalette.Surface.copy(alpha = .94f),
                                    shape = MaterialTheme.shapes.medium,
                                ) {
                                    Row {
                                        MapToolButton("Приблизить", Glyph.Plus) {
                                            scene?.let {
                                                it.camera(
                                                    it.camera()
                                                        .zoom(
                                                            1.2,
                                                            it.width / 2.0,
                                                            it.height / 2.0,
                                                            it.width,
                                                            it.height,
                                                        )
                                                )
                                            }
                                        }
                                        MapToolButton("Отдалить", Glyph.Minus) {
                                            scene?.let {
                                                it.camera(
                                                    it.camera()
                                                        .zoom(
                                                            1 / 1.2,
                                                            it.width / 2.0,
                                                            it.height / 2.0,
                                                            it.width,
                                                            it.height,
                                                        )
                                                )
                                            }
                                        }
                                        MapToolButton("Вписать карту", Glyph.Target) {
                                            scene?.let {
                                                it.camera(
                                                    it.camera()
                                                        .fit(
                                                            map.document.number("width"),
                                                            map.document.number("height"),
                                                            it.width,
                                                            it.height,
                                                        )
                                                )
                                            }
                                        }
                                        MapToolButton(
                                            if (orbit) "Перемещать камеру" else "Вращать камеру",
                                            Glyph.Transfer,
                                        ) {
                                            orbit = !orbit
                                        }
                                    }
                                }
                                if (placement != null)
                                    ShareBadge("${placement?.name} · коснитесь карты")
                                if (modelPending > 0) ShareBadge("Загружаем модели: $modelPending")
                            }
                            if (selected.isNotEmpty() && map.editable && tab.isEmpty())
                                Surface(
                                    Modifier.align(Alignment.TopEnd)
                                        .padding(12.dp)
                                        .width(panelWidth)
                                        .heightIn(max = inspectorHeight),
                                    color = WebPalette.Surface,
                                    shape = MaterialTheme.shapes.large,
                                ) {
                                    MapSelectionInspector(
                                        map,
                                        models,
                                        selectedIds,
                                        images,
                                        controller,
                                        clear = { selected = emptyList() },
                                        multiple = multiple,
                                        toggleMultiple = { multiple = !multiple },
                                    )
                                }
                        }
                    }
                    if (tab.isNotEmpty() && map.editable)
                        Surface(
                            Modifier.padding(start = 77.dp).width(panelWidth).fillMaxHeight(),
                            color = WebPalette.Surface,
                        ) {
                            MapEditorPanel(
                                tab,
                                map,
                                state.models,
                                images,
                                controller,
                                close = { tab = "" },
                                choose = {
                                    placement = it
                                    selected = emptyList()
                                    tab = ""
                                },
                                rotation = rotation,
                                level = level,
                                rotate = { rotation = (rotation + 90) % 360 },
                                setLevel = { level = it },
                                camera = { scene?.camera() },
                                viewport = { (scene?.width ?: 1) to (scene?.height ?: 1) },
                            )
                        }
                }
        }
        if (confirmLeave)
            MapPersistenceDialog(
                state,
                dismiss = { confirmLeave = false },
                library = {
                    confirmLeave = false
                    close()
                },
                retry = {
                    scope.launch {
                        inputs.flush()
                        if (controller.flush()) {
                            confirmLeave = false
                            close()
                        }
                    }
                },
                reload = controller::reload,
                saveCopy = {
                    scope.launch {
                        try {
                            val copy = controller.saveLocalCopy()
                            confirmLeave = false
                            replace(copy.id)
                        } catch (cancelled: kotlinx.coroutines.CancellationException) {
                            throw cancelled
                        } catch (_: Exception) {
                            /* The controller keeps the draft and displays the error. */
                        }
                    }
                },
            )
    }
}
