package ru.dndshare.client.ui.maps

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.*
import kotlinx.serialization.json.JsonPrimitive
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*
import ru.dndshare.client.ui.designsystem.*

private data class GuideLabelPosition(val label: MapGuideLabel, val x: Float, var y: Float)

@Composable
internal fun MapReferenceGuideOverlay(
    reference: MapReferenceController,
    guides: MapModelGuides,
    scene: FilamentMapScene,
) {
    val camera by scene.cameraState.collectAsState()
    Box(Modifier.fillMaxSize()) {
        val density = scene.density
        val width = scene.width.toFloat()
        val height = scene.height.toFloat()
        val labels =
            guides.labels
                .map { label ->
                    val point = camera.project(label.point, scene.width, scene.height)
                    GuideLabelPosition(
                        label,
                        point.first.coerceIn(
                            min(72 * density, width / 2),
                            max(width - 72 * density, width / 2),
                        ),
                        point.second.coerceIn(
                            min(18 * density, height / 2),
                            max(height - 18 * density, height / 2),
                        ),
                    )
                }
                .sortedBy { it.y }
        labels.forEachIndexed { index, p ->
            if (index > 0) p.y = max(p.y, labels[index - 1].y + 30 * density)
        }
        val excess = max(0f, (labels.lastOrNull()?.y ?: 0f) - height + 18 * density)
        for (position in labels) {
            val label = position.label
            val active = reference.activeField == label.field.key
            val colour = Color(android.graphics.Color.parseColor(label.field.colour))
            ShareTile(
                modifier =
                    Modifier.offset {
                            IntOffset(
                                (position.x - 72 * density).toInt(),
                                (position.y - excess - 14 * density).toInt(),
                            )
                        }
                        .width(144.dp),
                onClick = { reference.activeField = label.field.key },
                framed = active,
                tint = if (active) colour else null,
                contentPadding = PaddingValues(horizontal = 7.dp, vertical = 4.dp),
                containerColor = WebPalette.Popover.copy(alpha = .94f),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(label.field.caption, Modifier.weight(1f), fontSize = 10.sp, color = colour)
                    Text("%.2f".format(java.util.Locale.ROOT, label.value), fontSize = 11.sp)
                }
            }
        }
        Canvas(Modifier.fillMaxSize()) {
            for (marker in guides.markers) {
                val point = camera.project(marker.point, scene.width, scene.height)
                val centre = Offset(point.first, point.second)
                val selected =
                    marker.kind == "slot" && marker.index == reference.selectedSlot ||
                        marker.kind == "point" && marker.index == reference.selectedPoint
                val colour =
                    when {
                        !marker.valid -> WebPalette.Danger
                        selected -> Color(0xffd9b3ff)
                        marker.kind == "port" ->
                            if (marker.active) Color(0xffb59bf5) else Color(0xff626d7a)
                        marker.kind == "slot" -> Color(0xff66d3a0)
                        marker.active -> Color(0xff78d4e7)
                        else -> Color(0xff737d8a)
                    }
                val radius =
                    when (marker.kind) {
                        "port" -> 7.dp.toPx()
                        "slot" -> 6.dp.toPx()
                        else -> 5.dp.toPx()
                    }
                drawCircle(colour, radius, centre)
                drawCircle(WebPalette.Background, radius, centre, style = Stroke(1.dp.toPx()))
            }
        }
    }
}

internal fun pickReferenceGuide(
    reference: MapReferenceController,
    guides: MapModelGuides,
    scene: FilamentMapScene,
    pointer: MapPointer,
) {
    if (reference.saving) return
    val camera = scene.camera()
    val marker =
        guides.markers.minByOrNull { marker ->
            val p = camera.project(marker.point, scene.width, scene.height)
            hypot((p.first - pointer.x).toDouble(), (p.second - pointer.y).toDouble())
        } ?: return
    val projected = camera.project(marker.point, scene.width, scene.height)
    if (
        hypot((projected.first - pointer.x).toDouble(), (projected.second - pointer.y).toDouble()) >
            22 * scene.density
    )
        return
    when (marker.kind) {
        "slot" -> {
            reference.selectedSlot = marker.index
            reference.selectedPoint = -1
        }
        "point" -> {
            reference.selectedPoint = marker.index
            reference.selectedSlot = -1
        }
        "port" -> {
            val current = reference.currentDraft?.current ?: return
            reference.set(
                "wallMask",
                JsonPrimitive(current.number("wallMask").toInt() xor (1 shl marker.index)),
            )
        }
    }
}
