package ru.dndshare.client.ui.maps

import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import ru.dndshare.client.maps.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapModelPalette(
    workspace: MapEditorWorkspace,
    images: ImageLoader,
    objects: Boolean,
    choose: (MapModel) -> Unit,
    inspect: Boolean = false,
    selectedId: String = "",
    candidates: List<MapModel>? = null,
    collectionChange: ((String) -> Unit)? = null,
) {
    val models = candidates ?: workspace.models
    val ui = workspace.ui
    val eligible =
        remember(models, objects) { models.filter { !it.hidden && it.isObject == objects } }
    val packs =
        remember(eligible) {
            eligible
                .groupBy { it.collection }
                .map { (id, rows) -> id to rows.first().collectionName.ifBlank { id } }
        }
    val collection =
        ui.collection.takeIf { value -> packs.any { it.first == value } }
            ?: packs.firstOrNull()?.first.orEmpty()
    val inPack =
        remember(eligible, collection, objects) {
            if (objects) eligible else eligible.filter { it.collection == collection }
        }
    val categories =
        remember(inPack) {
            mapTileCategories.filter { (id, _) -> inPack.any { it.category == id } }
        }
    val category =
        ui.category.takeIf { value -> categories.any { it.first == value } }
            ?: categories.firstOrNull()?.first.orEmpty()
    LaunchedEffect(collection, category, objects) {
        if (!objects && (ui.collection != collection || ui.category != category))
            workspace.controller.ui { it.copy(collection = collection, category = category) }
    }
    val sections by
        produceState<List<MapCatalogueSection>?>(
            null,
            inPack,
            objects,
            category,
            ui.contentFilter,
            ui.lightFilter,
        ) {
            value = null
            value =
                withContext(Dispatchers.Default) {
                    mapCatalogueSections(
                        inPack.filter { model ->
                            objects ||
                                (model.category == category &&
                                    (ui.contentFilter == "all" ||
                                        model.hasDecor == (ui.contentFilter == "furnished")) &&
                                    (ui.lightFilter == "all" ||
                                        model.behaviour.rows("defaultLights").isNotEmpty() ==
                                            (ui.lightFilter == "with")))
                        },
                        !objects && category == "wall",
                    )
                }
        }
    LazyVerticalGrid(
        GridCells.Fixed(2),
        Modifier.fillMaxSize(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (!objects) {
            item(span = { GridItemSpan(2) }) {
                MapPackPicker(packs, collection, images) { id ->
                    if (collectionChange != null) collectionChange(id)
                    else workspace.controller.ui { it.copy(collection = id) }
                }
            }
            item(span = { GridItemSpan(2) }) {
                MapPaletteFilterHeading(
                    workspace,
                    categories.firstOrNull { it.first == category }?.second.orEmpty(),
                )
            }
            item(span = { GridItemSpan(2) }) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    categories.chunked(3).forEach { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            row.forEach { (kind, title) ->
                                Surface(
                                    { workspace.controller.ui { it.copy(category = kind) } },
                                    Modifier.weight(1f).height(80.dp).semantics {
                                        contentDescription = title
                                    },
                                    color =
                                        if (category == kind) WebPalette.Active
                                        else WebPalette.Raised,
                                    shape = MaterialTheme.shapes.medium,
                                ) {
                                    val icon = if (kind == "wall") "wall-straight" else kind
                                    Box(contentAlignment = Alignment.Center) {
                                        AsyncImage(
                                            "file:///android_asset/maps/tile-types/$icon.webp",
                                            null,
                                            imageLoader = images,
                                            modifier = Modifier.size(64.dp),
                                            contentScale = ContentScale.Fit,
                                        )
                                    }
                                }
                            }
                            repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                }
            }
        }
        item(span = { GridItemSpan(2) }) {
            Text(
                if (inspect) "Выберите модель для просмотра параметров."
                else if (objects) "Выберите объект и поставьте его на подсвеченную точку."
                else "Выберите плитку или перетащите её на карту.",
                style = ShareTypography.context,
                color = WebPalette.TextMuted,
            )
        }
        if (sections == null || workspace.state.modelLoading && models.isEmpty())
            items(4) { ShareSkeletonBlock(Modifier.fillMaxWidth(), 140.dp) }
        else if (sections.orEmpty().isEmpty())
            item(span = { GridItemSpan(2) }) {
                Text(
                    "Нет моделей с выбранными параметрами.",
                    style = ShareTypography.context,
                    color = WebPalette.TextMuted,
                )
            }
        else
            sections.orEmpty().forEach { section ->
                item(key = "heading-${section.key}", span = { GridItemSpan(2) }) {
                    Column(
                        Modifier.padding(top = 12.dp, bottom = 2.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(section.name, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        if (section.subtitle.isNotEmpty())
                            Text(
                                section.subtitle,
                                style = ShareTypography.context,
                                color = WebPalette.TextMuted,
                            )
                    }
                }
                items(section.models, key = { it.uuid }) { model ->
                    var coordinates by remember { mutableStateOf<LayoutCoordinates?>(null) }
                    var dragPosition by remember {
                        mutableStateOf(androidx.compose.ui.geometry.Offset.Zero)
                    }
                    MapModelCard(
                        model,
                        images,
                        selectedId == model.uuid ||
                            (ui.tool as? MapTool.Model)?.modelId == model.uuid,
                        inspect,
                        Modifier.onGloballyPositioned { coordinates = it }
                            .then(
                                if (inspect) Modifier
                                else
                                    Modifier.pointerInput(model.uuid) {
                                        detectDragGesturesAfterLongPress(
                                            onDragStart = { position ->
                                                dragPosition = position
                                                workspace.paletteDrag.start(model)
                                                coordinates
                                                    ?.localToRoot(position)
                                                    ?.let(workspace.paletteDrag::move)
                                            },
                                            onDragEnd = workspace.paletteDrag::end,
                                            onDragCancel = workspace.paletteDrag::cancel,
                                        ) { change, amount ->
                                            change.consume()
                                            dragPosition += amount
                                            coordinates
                                                ?.takeIf { it.isAttached }
                                                ?.localToRoot(dragPosition)
                                                ?.let(workspace.paletteDrag::move)
                                        }
                                    }
                            ),
                    ) {
                        choose(model)
                    }
                }
            }
    }
}

@Composable
internal fun MapPackPicker(
    packs: List<Pair<String, String>>,
    selected: String,
    images: ImageLoader,
    choose: (String) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    Box {
        ShareOutlinedButton({ open = true }, modifier = Modifier.fillMaxWidth()) {
            MapPackIcon(selected, images)
            Column(Modifier.weight(1f)) {
                Text("Пак тайлов", fontSize = 11.sp, color = WebPalette.TextMuted)
                Text(
                    packs.firstOrNull { it.first == selected }?.second ?: "Выберите пак",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            AppGlyph(Glyph.Chevron, Modifier.size(16.dp))
        }
        ShareDropdownMenu(open, { open = false }) {
            packs.forEach { (id, name) ->
                ShareDropdownMenuItem(
                    text = { Text(name) },
                    leadingIcon = { MapPackIcon(id, images) },
                    trailingIcon =
                        if (id == selected) {
                            { AppGlyph(Glyph.CircleCheck) }
                        } else null,
                    onClick = {
                        choose(id)
                        open = false
                    },
                )
            }
        }
    }
}

@Composable
private fun MapPaletteFilterHeading(workspace: MapEditorWorkspace, title: String) {
    var open by remember { mutableStateOf(false) }
    val ui = workspace.ui
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(title, Modifier.weight(1f), fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Box {
            MapToolButton("Фильтры плиток", Glyph.Filter) { open = !open }
            ShareDropdownMenu(open, { open = false }) {
                ShareSelect(
                    "Наполнение",
                    ui.contentFilter,
                    listOf(
                        "all" to "Любое наполнение",
                        "free" to "Свободные",
                        "furnished" to "С предметами",
                    ),
                ) { v ->
                    workspace.controller.ui { it.copy(contentFilter = v) }
                }
                Spacer(Modifier.height(10.dp))
                ShareSelect(
                    "Освещение",
                    ui.lightFilter,
                    listOf(
                        "all" to "Любое освещение",
                        "with" to "Есть освещение",
                        "without" to "Без освещения",
                    ),
                ) { v ->
                    workspace.controller.ui { it.copy(lightFilter = v) }
                }
            }
        }
    }
}
