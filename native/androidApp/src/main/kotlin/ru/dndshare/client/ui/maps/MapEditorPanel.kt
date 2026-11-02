package ru.dndshare.client.ui.maps

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import java.util.UUID
import kotlin.math.*
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.MapCamera
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapEditorPanel(
    tab: String,
    map: BattleMap,
    models: List<MapModel>,
    images: ImageLoader,
    controller: MapEditorController,
    close: () -> Unit,
    choose: (MapModel) -> Unit,
    rotation: Int,
    level: Int,
    rotate: () -> Unit,
    setLevel: (Int) -> Unit,
    camera: () -> MapCamera?,
    viewport: () -> Pair<Int, Int>,
) {
    Column(
        Modifier.fillMaxSize().padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                mapOf(
                        "tiles" to "Плитки",
                        "objects" to "Объекты",
                        "lights" to "Освещение",
                        "areas" to "Области",
                        "cameras" to "Камеры",
                        "settings" to "Настройки",
                    )[tab]
                    .orEmpty(),
                Modifier.weight(1f),
                style = ShareTypography.header,
            )
            MapToolButton("Свернуть панель", Glyph.Collapse, run = close)
        }
        if (tab == "tiles" || tab == "objects")
            MapModelPalette(
                models,
                tab == "objects",
                images,
                rotation,
                level,
                rotate,
                setLevel,
                choose,
            )
        else
            Column(
                Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                when (tab) {
                    "settings" -> MapSettingsFields(map, controller)
                    "lights" -> MapLightPanel(map, controller)
                    "areas" -> MapAreasPanel(map, controller)
                    "cameras" -> {
                        ShareOutlinedButton({
                            val view = camera() ?: return@ShareOutlinedButton
                            val (width, height) = viewport()
                            val eye = view.eye
                            val record = buildJsonObject {
                                put("id", UUID.randomUUID().toString())
                                put("name", "Камера ${map.document.rows("cameras").size + 1}")
                                put(
                                    "view",
                                    buildJsonObject {
                                        put(
                                            "position",
                                            JsonArray(
                                                listOf(eye[0], eye[2], eye[1]).map(::JsonPrimitive)
                                            ),
                                        )
                                        put(
                                            "target",
                                            JsonArray(
                                                listOf(view.x, view.y, 0.0).map(::JsonPrimitive)
                                            ),
                                        )
                                        put(
                                            "up",
                                            JsonArray(
                                                listOf(
                                                        -sin(Math.toRadians(view.azimuth)),
                                                        -cos(Math.toRadians(view.azimuth)),
                                                        0.0,
                                                    )
                                                    .map(::JsonPrimitive)
                                            ),
                                        )
                                        put("width", width / view.pixels)
                                        put(
                                            "aspect",
                                            (width.toDouble() / height.coerceAtLeast(1)).coerceIn(
                                                .25,
                                                4.0,
                                            ),
                                        )
                                    },
                                )
                            }
                            controller.document {
                                it.with("cameras", JsonArray(it.rows("cameras") + record))
                            }
                        }) {
                            AppGlyph(Glyph.Plus)
                            Text("Добавить камеру")
                        }
                        map.document.rows("cameras").forEach { row ->
                            ShareTextInput(
                                row.string("name"),
                                { name ->
                                    if (name.isNotBlank())
                                        controller.document {
                                            mapReplace(
                                                it,
                                                "cameras",
                                                row.with("name", JsonPrimitive(name)),
                                            )
                                        }
                                },
                                "Название камеры",
                            )
                            ShareTextButton({
                                controller.document {
                                    it.with(
                                        "cameras",
                                        JsonArray(
                                            it.rows("cameras").filter { c ->
                                                c.string("id") != row.string("id")
                                            }
                                        ),
                                    )
                                }
                            }) {
                                Text("Удалить камеру", color = WebPalette.Danger)
                            }
                        }
                    }
                }
            }
    }
}

@Composable
private fun ColumnScope.MapModelPalette(
    models: List<MapModel>,
    objects: Boolean,
    images: ImageLoader,
    rotation: Int,
    level: Int,
    rotate: () -> Unit,
    setLevel: (Int) -> Unit,
    choose: (MapModel) -> Unit,
) {
    val eligible =
        remember(models, objects) { models.filter { !it.hidden && it.isObject == objects } }
    var collection by rememberSaveable(objects) { mutableStateOf("") }
    var category by rememberSaveable(objects) { mutableStateOf("") }
    val collections = eligible.map { it.collection }.distinct()
    val selectedCollection =
        collection.takeIf { it in collections } ?: collections.firstOrNull().orEmpty()
    val inCollection = eligible.filter { objects || it.collection == selectedCollection }
    val categories = inCollection.map { it.category }.distinct()
    val selectedCategory =
        category.takeIf { it in categories } ?: categories.firstOrNull().orEmpty()
    if (!objects)
        ShareSelect(
            "Набор моделей",
            selectedCollection,
            collections.map { key ->
                key to
                    (eligible.firstOrNull { it.collection == key }?.collectionName?.ifBlank { key }
                        ?: key)
            },
        ) {
            collection = it
        }
    val labels =
        mapOf(
            "floor" to "Пол",
            "wall" to "Стены",
            "water" to "Вода",
            "railway" to "Железная дорога",
            "stairs" to "Лестницы",
            "frame" to "Каркасы",
            "bridge" to "Мосты",
            "passage" to "Проходы",
            "column" to "Колонны",
            "object" to "Объекты",
        )
    ShareSelect("Категория", selectedCategory, categories.map { it to (labels[it] ?: it) }) {
        category = it
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        ShareTextButton(rotate) { Text("Поворот: $rotation°") }
        if (!objects) {
            MapToolButton("Уровень ниже", Glyph.Minus, level > 0) { setLevel(level - 1) }
            Text(level.toString())
            MapToolButton("Уровень выше", Glyph.Plus, level < 15) { setLevel(level + 1) }
        }
    }
    LazyVerticalGrid(
        GridCells.Fixed(2),
        Modifier.weight(1f),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(inCollection.filter { it.category == selectedCategory }, key = { it.uuid }) { model ->
            ShareTile(
                onClick = { choose(model) },
                framed = false,
                contentPadding = PaddingValues(6.dp),
            ) {
                AsyncImage(
                    model.previewUrl,
                    null,
                    imageLoader = images,
                    modifier = Modifier.fillMaxWidth().height(104.dp),
                    contentScale = ContentScale.Fit,
                )
                Text(model.name, style = ShareTypography.context, minLines = 2)
                if (model.width > 1 || model.height > 1)
                    Text(
                        "${model.width} × ${model.height}",
                        style = ShareTypography.context,
                        color = WebPalette.TextMuted,
                    )
            }
        }
    }
}
