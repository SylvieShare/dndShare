package ru.dndshare.client.ui.maps

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapSelectionInspector(
    map: BattleMap,
    models: Map<String, MapModel>,
    selected: Set<String>,
    images: ImageLoader,
    controller: MapEditorController,
    clear: () -> Unit,
    multiple: Boolean,
    toggleMultiple: () -> Unit,
) {
    Column(
        Modifier.padding(16.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        val row =
            (map.document.rows("tiles") + map.document.rows("objects")).find {
                it.string("id") in selected
            }
        val model = row?.let { models[it.string("modelId")] }
        Row {
            Text(
                if (selected.size == 1) model?.name ?: "Элемент карты"
                else "Выбрано: ${selected.size}",
                Modifier.weight(1f),
                style = ShareTypography.header,
            )
            MapToolButton("Снять выделение", Glyph.Close, run = clear)
        }
        if (model != null)
            AsyncImage(
                model.previewUrl,
                null,
                imageLoader = images,
                modifier = Modifier.fillMaxWidth().height(140.dp),
            )
        Row {
            ShareTextButton({
                controller.document { mapTransformSelection(it, models, selected, mirror = false) }
            }) {
                AppGlyph(Glyph.Transfer)
                Text("Повернуть")
            }
            ShareTextButton({
                controller.document { mapTransformSelection(it, models, selected, mirror = true) }
            }) {
                Text("Отразить")
            }
            MapToolButton("Удалить выбранное", Glyph.Trash) {
                controller.document { mapRemove(it, models, selected) }
                clear()
            }
        }
        ShareToggle("Выбирать несколько", multiple) { toggleMultiple() }
        val areas = map.document.rows("areas")
        if (areas.isNotEmpty()) {
            ShareSelect(
                "Добавить в область",
                "",
                areas.map { it.string("id") to it.string("name") },
            ) { id ->
                controller.document { doc ->
                    val tiles =
                        doc.rows("tiles")
                            .filter { it.string("id") in selected }
                            .map { JsonPrimitive(it.string("id")) }
                    val objects =
                        doc.rows("objects")
                            .filter { it.string("id") in selected }
                            .map { JsonPrimitive(it.string("id")) }
                    val area = doc.rows("areas").first { it.string("id") == id }
                    mapReplace(
                        doc,
                        "areas",
                        area
                            .with(
                                "tileIds",
                                JsonArray(
                                    ((area["tileIds"] as? JsonArray).orEmpty() + tiles).distinct()
                                ),
                            )
                            .with(
                                "objectIds",
                                JsonArray(
                                    ((area["objectIds"] as? JsonArray).orEmpty() + objects)
                                        .distinct()
                                ),
                            ),
                    )
                }
            }
        }
    }
}
