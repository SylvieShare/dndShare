package ru.dndshare.client.ui.maps

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import java.util.Locale
import kotlin.math.round
import ru.dndshare.client.maps.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapInspectorSection(
    title: String,
    actions: @Composable RowScope.() -> Unit = {},
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                title,
                Modifier.weight(1f),
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = WebPalette.TextMuted,
            )
            actions()
        }
        content()
    }
}

@Composable
internal fun MapRange(
    label: String,
    value: Double,
    min: Double,
    max: Double,
    step: Double,
    change: (Double) -> Unit,
    finish: () -> Unit,
) {
    Column {
        Text(
            "$label: ${if(step>=1)value.toInt().toString() else String.format(Locale.ROOT,"%.2f",value).trimEnd('0').trimEnd('.')}",
            style = ShareTypography.context,
        )
        ShareSlider(
            value.toFloat(),
            { change((round(it / step) * step).coerceIn(min, max)) },
            Modifier.semantics { contentDescription = label },
            valueRange = min.toFloat()..maxOf(max, value).toFloat(),
            onValueChangeFinished = finish,
        )
    }
}

internal fun mapEntityName(
    ref: MapEntityRef,
    document: kotlinx.serialization.json.JsonObject,
    models: List<MapModel>,
): String {
    val row = ref.row(document) ?: return "Элемент удалён"
    return if (ref.kind in setOf(MapEntityKind.Tile, MapEntityKind.Object))
        models.find { it.uuid == row.string("modelId") }?.name
            ?: row.string("name", MapBuiltinProps.labels[row.string("kind")] ?: "Объект")
    else row.string("name", if (ref.kind == MapEntityKind.Camera) "Камера" else "Элемент карты")
}

internal fun mapEntityGlyph(kind: MapEntityKind) =
    when (kind) {
        MapEntityKind.Tile -> Glyph.Layers
        MapEntityKind.Object -> Glyph.Box
        MapEntityKind.Light -> Glyph.Lightbulb
        MapEntityKind.Decal -> Glyph.Sticker
        MapEntityKind.Area -> Glyph.Group
        MapEntityKind.Camera -> Glyph.Camera
    }

@Composable
internal fun MapEntityRow(
    workspace: MapEditorWorkspace,
    ref: MapEntityRef,
    images: ImageLoader,
    select: () -> Unit = { workspace.focus(ref, push = true) },
    actions: @Composable RowScope.() -> Unit = {},
) {
    val doc = workspace.map?.document ?: return
    val row = ref.row(doc) ?: return
    val model = workspace.models.find { it.uuid == row.string("modelId") }
    Surface(select, color = WebPalette.Raised, shape = MaterialTheme.shapes.medium) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (model?.previewUrl?.isNotBlank() == true)
                AsyncImage(
                    mapImageUrl(model.previewUrl),
                    null,
                    imageLoader = images,
                    modifier = Modifier.size(40.dp),
                )
            else AppGlyph(mapEntityGlyph(ref.kind), Modifier.size(24.dp))
            Text(mapEntityName(ref, doc, workspace.models), Modifier.weight(1f), fontSize = 14.sp)
            actions()
        }
    }
}
