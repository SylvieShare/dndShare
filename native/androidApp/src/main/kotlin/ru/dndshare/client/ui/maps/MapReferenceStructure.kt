package ru.dndshare.client.ui.maps

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapReferencePoint(reference: MapReferenceController, index: Int) {
    val current = reference.draft?.current ?: return
    val point = current.rows("placementPoints").getOrNull(index) ?: return
    val inputs = LocalShareFormInputs.current
    val focus = LocalFocusManager.current
    ShareTile(
        framed = reference.selectedPoint == index,
        tint = if (reference.selectedPoint == index) WebPalette.Accent else null,
        contentPadding = PaddingValues(12.dp),
        onClick = {
            reference.selectedPoint = index
            reference.selectedSlot = -1
        },
    ) {
        Text("Место ${index+1}", style = ShareTypography.context)
        for ((key, label) in
            listOf("x" to "X", "y" to "Y", "elevation" to "Высота")) ReferenceNumber(
            point.number(key),
            "Место ${index+1}: $label",
        ) { value ->
            value
                .replace(',', '.')
                .toDoubleOrNull()
                ?.takeIf { it.isFinite() }
                ?.let { reference.listField("placementPoints", index, key, JsonPrimitive(it)) }
        }
        for (axis in listOf("x", "y")) ShareNumberInput(
            "Место ${index+1}: ячейка $axis",
            (point["cell"] as? JsonObject)?.number(axis)?.toInt()?.toString() ?: "0",
        ) { value ->
            value.toIntOrNull()?.let {
                reference.listField(
                    "placementPoints",
                    index,
                    "cell",
                    (point["cell"] as? JsonObject ?: buildJsonObject {}).with(
                        axis,
                        JsonPrimitive(it),
                    ),
                )
            }
        }
        ShareTextButton({
            inputs?.flush()
            focus.clearFocus()
            reference.remove("placementPoints", index)
        }) {
            AppGlyph(Glyph.Trash)
            Text("Удалить место", color = WebPalette.Danger)
        }
    }
}

@Composable
internal fun MapReferenceSlot(reference: MapReferenceController, index: Int) {
    val current = reference.draft?.current ?: return
    val slot = current.rows("supportSlots").getOrNull(index) ?: return
    val inputs = LocalShareFormInputs.current
    val focus = LocalFocusManager.current
    var profile by remember(index) { mutableStateOf("") }
    ShareTile(
        framed = reference.selectedSlot == index,
        tint = if (reference.selectedSlot == index) WebPalette.Accent else null,
        contentPadding = PaddingValues(12.dp),
        onClick = {
            reference.selectedSlot = index
            reference.selectedPoint = -1
        },
    ) {
        Text("Паз ${index+1}", style = ShareTypography.context)
        for ((key, label) in
            listOf(
                "x" to "X",
                "y" to "Z",
                "width" to "Ширина",
                "height" to "Длина",
                "elevation" to "Высота",
            )) ReferenceNumber(slot.number(key), "Паз ${index+1}: $label") { value ->
            if (key == "elevation")
                value
                    .replace(',', '.')
                    .toDoubleOrNull()
                    ?.takeIf { it.isFinite() }
                    ?.let { reference.listField("supportSlots", index, key, JsonPrimitive(it)) }
            else
                value.toIntOrNull()?.let {
                    reference.listField("supportSlots", index, key, JsonPrimitive(it))
                }
        }
        if (current.string("tileType") == "frame") {
            ReferenceNumber(slot.number("insertionRise"), "Паз ${index+1}: подъём при вставке") {
                value ->
                value
                    .replace(',', '.')
                    .toDoubleOrNull()
                    ?.takeIf { it.isFinite() }
                    ?.let {
                        reference.listField(
                            "supportSlots",
                            index,
                            "insertionRise",
                            JsonPrimitive(it),
                        )
                    }
            }
            val rises = slot["insertionRises"] as? JsonObject ?: buildJsonObject {}
            for ((name, value) in rises) {
                ReferenceNumber(value.jsonPrimitive.double, "Подъём: $name") { text ->
                    text
                        .replace(',', '.')
                        .toDoubleOrNull()
                        ?.takeIf { it.isFinite() }
                        ?.let {
                            reference.listField(
                                "supportSlots",
                                index,
                                "insertionRises",
                                rises.with(name, JsonPrimitive(it)),
                            )
                        }
                }
                ShareTextButton({
                    reference.listField(
                        "supportSlots",
                        index,
                        "insertionRises",
                        rises.without(name),
                    )
                }) {
                    AppGlyph(Glyph.Trash)
                    Text("Удалить профиль $name")
                }
            }
            ShareTextInput(profile, { profile = it }, "Новый профиль выступа")
            ShareOutlinedButton(
                {
                    reference.listField(
                        "supportSlots",
                        index,
                        "insertionRises",
                        rises.with(profile, JsonPrimitive(slot.number("insertionRise"))),
                    )
                    profile = ""
                },
                enabled = profile.matches(Regex("[a-z][a-z0-9-]{0,63}")) && rises.size < 16,
            ) {
                AppGlyph(Glyph.Plus)
                Text("Добавить профиль")
            }
        }
        ShareTextButton({
            inputs?.flush()
            focus.clearFocus()
            reference.remove("supportSlots", index)
        }) {
            AppGlyph(Glyph.Trash)
            Text("Удалить паз", color = WebPalette.Danger)
        }
    }
}

internal fun addReferencePoint(reference: MapReferenceController) {
    val current = reference.currentDraft?.current ?: return
    if (current.rows("placementPoints").size >= 256) return
    reference.add(
        "placementPoints",
        buildJsonObject {
            put(
                "cell",
                buildJsonObject {
                    put("x", ((current.number("width", 1.0).toInt() - 1) / 2))
                    put("y", ((current.number("height", 1.0).toInt() - 1) / 2))
                },
            )
            put("x", current.number("width", 1.0) / 2)
            put("y", current.number("height", 1.0) / 2)
            put("elevation", current.number("surfaceHeight"))
        },
    )
    reference.selectedPoint = reference.currentDraft!!.current.rows("placementPoints").lastIndex
}

internal fun addReferenceSlot(reference: MapReferenceController) {
    val current = reference.currentDraft?.current ?: return
    if (current.rows("supportSlots").size >= 64) return
    reference.add(
        "supportSlots",
        buildJsonObject {
            put("x", 0)
            put("y", 0)
            put("width", 1)
            put("height", 1)
            put("elevation", current.number("maxHeight"))
        },
    )
    reference.selectedSlot = reference.currentDraft!!.current.rows("supportSlots").lastIndex
}
