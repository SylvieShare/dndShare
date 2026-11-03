package ru.dndshare.client.ui.maps

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import ru.dndshare.client.maps.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapSelectionInspector(workspace: MapEditorWorkspace, images: ImageLoader) {
    val doc = workspace.map?.document ?: return
    val focus = workspace.ui.focus
    val refs = focus.entity?.let(::listOf) ?: focus.selected
    val ref = refs.singleOrNull()
    val row = ref?.row(doc)
    val model = row?.let { r -> workspace.models.find { it.uuid == r.string("modelId") } }
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (workspace.ui.back.isNotEmpty())
                MapToolButton("Вернуться к предыдущему фокусу", Glyph.Back) {
                    workspace.controller.ui {
                        it.copy(focus = it.back.last(), back = it.back.dropLast(1))
                    }
                }
            AppGlyph(ref?.let { mapEntityGlyph(it.kind) } ?: Glyph.Group)
            Text(
                ref?.let { mapEntityName(it, doc, workspace.models) } ?: "Выбрано: ${refs.size}",
                Modifier.weight(1f),
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
            )
            MapToolButton("Снять выделение", Glyph.Close, run = workspace::clearFocus)
        }
        Column(
            Modifier.weight(1f, fill = false)
                .verticalScroll(rememberScrollState())
                .padding(start = 14.dp, end = 14.dp, bottom = 14.dp),
            verticalArrangement = Arrangement.spacedBy(25.dp),
        ) {
            if (ref != null && row != null) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ShareTile(
                        Modifier.weight(1f).height(150.dp),
                        framed = false,
                        containerColor = WebPalette.MapPreview,
                        contentPadding = PaddingValues(6.dp),
                    ) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            val url =
                                if (ref.kind == MapEntityKind.Decal) row.string("imageUrl")
                                else model?.previewUrl.orEmpty()
                            if (url.isNotBlank())
                                AsyncImage(
                                    mapImageUrl(url),
                                    null,
                                    imageLoader = images,
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Fit,
                                )
                            else AppGlyph(mapEntityGlyph(ref.kind), Modifier.size(48.dp))
                        }
                    }
                    Column {
                        if (ref.kind !in setOf(MapEntityKind.Area, MapEntityKind.Camera))
                            MapToolButton("Копировать", Glyph.Copy) { workspace.selection.copy() }
                        MapToolButton(
                            if (
                                ref.kind == MapEntityKind.Light &&
                                    row.string("builtinKey").isNotBlank()
                            )
                                "Отключить встроенный источник"
                            else "Удалить",
                            Glyph.Trash,
                        ) {
                            workspace.selection.remove()
                        }
                    }
                }
                when (ref.kind) {
                    MapEntityKind.Tile,
                    MapEntityKind.Object -> MapModelFields(workspace, ref, images)
                    MapEntityKind.Light -> MapLightFields(workspace, ref.id, images)
                    MapEntityKind.Decal -> MapDecalFields(workspace, ref.id, images)
                    MapEntityKind.Area -> MapAreaFields(workspace, ref.id, images)
                    MapEntityKind.Camera -> MapCameraFields(workspace, ref.id)
                }
            } else {
                val groups = refs.groupBy { reference ->
                    val item = reference.row(doc)
                    "${reference.kind.wire}:${item?.string("modelId")}"
                }
                groups.values.forEach { members ->
                    val first = members.first()
                    ShareOutlinedButton(
                        { workspace.focus(MapFocus(members), push = true) },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        AppGlyph(mapEntityGlyph(first.kind))
                        Text("${mapEntityName(first,doc,workspace.models)} × ${members.size}")
                    }
                }
                ShareToggle("Выбирать несколько", workspace.ui.multiple) { v ->
                    workspace.controller.ui { it.copy(multiple = v) }
                }
                MapInspectorSection("Область") {
                    ShareSelect(
                        "Добавить в область",
                        "",
                        doc.rows("areas").map { it.string("id") to it.string("name") },
                    ) {
                        workspace.selection.area(it)
                    }
                    ShareTextButton(workspace.selection::createArea) {
                        AppGlyph(Glyph.Plus)
                        Text("Создать область")
                    }
                }
                Row {
                    MapToolButton("Повернуть", Glyph.Rotate) { workspace.selection.rotate() }
                    MapToolButton("Отразить", Glyph.Flip) {
                        workspace.selection.rotate(mirror = true)
                    }
                    MapToolButton("Копировать", Glyph.Copy) { workspace.selection.copy() }
                    MapToolButton("Удалить выбранное", Glyph.Trash) { workspace.selection.remove() }
                }
            }
        }
    }
}
