package ru.dndshare.client.ui.maps

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapReferenceWater(reference: MapReferenceController) {
    val behaviour = reference.draft?.current?.get("behaviour") as? JsonObject ?: return
    val water =
        behaviour["waterAnimation"] as? JsonObject
            ?: buildJsonObject {
                put("enabled", false)
                put("pattern", "pool")
                put("speed", 1)
                put("strength", .7)
                put("roughnessMax", .5)
                put("center", numbers(0.0, 0.0))
            }
    fun patch(key: String, value: JsonElement) =
        reference.behaviour("waterAnimation", water.with(key, value))
    MapInspectorSection("Анимация воды") {
        ShareToggle("Анимировать воду", water.flag("enabled")) {
            patch("enabled", JsonPrimitive(it))
        }
        ShareSelect(
            "Движение воды",
            water.string("pattern", "pool"),
            listOf("pool" to "Рябь", "surface" to "Волны", "vortex" to "Водоворот"),
        ) {
            patch("pattern", JsonPrimitive(it))
        }
        MapRange(
            "Скорость течения",
            water.number("speed", 1.0),
            0.0,
            3.0,
            .05,
            { patch("speed", JsonPrimitive(it)) },
            {},
        )
        MapRange(
            "Сила волн",
            water.number("strength", .7),
            0.0,
            2.0,
            .05,
            { patch("strength", JsonPrimitive(it)) },
            {},
        )
    }
}

@Composable
internal fun MapReferenceTransition(
    reference: MapReferenceController,
    index: Int,
    catalogue: List<MapModel>,
) {
    val current = reference.draft?.current ?: return
    val behaviour = current["behaviour"] as? JsonObject ?: return
    val row = behaviour.rows("transitions").getOrNull(index) ?: return
    val targets =
        catalogue
            .filter {
                !it.hidden &&
                    it.id != current.string("id") &&
                    it.isObject == (current.string("tileType") == "object")
            }
            .sortedWith(compareBy({ it.collection }, { it.raw.string("sourceCode") }))
    ShareTile(framed = false, contentPadding = PaddingValues(12.dp)) {
        ShareSelect(
            "Переход ${index+1}: действие",
            row.string("action", "open"),
            mapTransitionLabels.toList(),
        ) {
            reference.behaviourRow("transitions", index, "action", JsonPrimitive(it))
        }
        ShareSelect(
            "Переход ${index+1}: модель",
            row.string("toDefinitionId"),
            targets.map { it.id to "${it.collectionName} · ${it.name}" },
        ) {
            reference.behaviourRow("transitions", index, "toDefinitionId", JsonPrimitive(it))
        }
        ShareTextButton({
            reference.behaviour(
                "transitions",
                JsonArray(behaviour.rows("transitions").filterIndexed { i, _ -> i != index }),
            )
        }) {
            AppGlyph(Glyph.Trash)
            Text("Удалить переход", color = WebPalette.Danger)
        }
    }
}

@Composable
internal fun MapReferenceLight(reference: MapReferenceController, index: Int) {
    val current = reference.draft?.current ?: return
    val behaviour = current["behaviour"] as? JsonObject ?: return
    val light = behaviour.rows("defaultLights").getOrNull(index) ?: return
    val effect = light["effect"] as? JsonObject
    fun patch(key: String, value: JsonElement) =
        reference.behaviourRow("defaultLights", index, key, value)
    fun coordinate(axis: Int, value: Double) {
        val p = light.array("position").toMutableList()
        while (p.size < 3) p += JsonPrimitive(0)
        p[axis] = JsonPrimitive(value)
        patch("position", JsonArray(p))
    }
    ShareTile(framed = false, contentPadding = PaddingValues(12.dp)) {
        ShareTextInput(
            light.string("name"),
            { patch("name", JsonPrimitive(it)) },
            "Встроенный источник ${index+1}: название",
        )
        ShareSelect(
            "Тип источника",
            light.string("kind", "torch"),
            listOf("torch" to "Факел", "candle" to "Свеча", "magic" to "Магический свет"),
        ) {
            patch("kind", JsonPrimitive(it))
        }
        for ((axis, label) in listOf(0 to "X", 1 to "Y", 2 to "Высота")) ReferenceNumber(
            light.array("position").double(axis) +
                (if (axis == 2) effect?.array("offset")?.double(2) ?: 0.0 else 0.0),
            "Встроенный источник ${index+1}: $label",
        ) { value ->
            value
                .replace(',', '.')
                .toDoubleOrNull()
                ?.takeIf { it.isFinite() }
                ?.let {
                    coordinate(
                        axis,
                        it - (if (axis == 2) effect?.array("offset")?.double(2) ?: 0.0 else 0.0),
                    )
                }
        }
        ReferenceNumber(light.number("intensity", 8.0), "Яркость") { value ->
            value
                .replace(',', '.')
                .toDoubleOrNull()
                ?.takeIf { it.isFinite() }
                ?.let { patch("intensity", JsonPrimitive(it)) }
        }
        ReferenceNumber(light.number("radius", 4.5), "Радиус") { value ->
            value
                .replace(',', '.')
                .toDoubleOrNull()
                ?.takeIf { it.isFinite() }
                ?.let { patch("radius", JsonPrimitive(it)) }
        }
        ShareColorInput(
            light.string("color", "#ffc36a"),
            { patch("color", JsonPrimitive(it)) },
            "Цвет источника",
        )
        ShareToggle("Включён по умолчанию", light.flag("enabled", true)) {
            patch("enabled", JsonPrimitive(it))
        }
        if (effect == null)
            ShareToggle("Мерцание", light.flag("flicker", true)) {
                patch("flicker", JsonPrimitive(it))
            }
        if (effect != null)
            ReferenceNumber(-effect.array("offset").double(2), "Смещение источника света") { value
                ->
                value
                    .replace(',', '.')
                    .toDoubleOrNull()
                    ?.takeIf { it.isFinite() }
                    ?.let { offset ->
                        val base =
                            light.array("position").double(2) + effect.array("offset").double(2)
                        val p = light.array("position").toMutableList()
                        p[2] = JsonPrimitive(base + offset)
                        val replacement =
                            light
                                .with("position", JsonArray(p))
                                .with(
                                    "effect",
                                    effect.with(
                                        "offset",
                                        numbers(
                                            effect.array("offset").double(0),
                                            effect.array("offset").double(1),
                                            -offset,
                                        ),
                                    ),
                                )
                        reference.behaviour(
                            "defaultLights",
                            JsonArray(
                                behaviour.rows("defaultLights").mapIndexed { i, row ->
                                    if (i == index) replacement else row
                                }
                            ),
                        )
                    }
            }
        MapFireEffectFields(effect, { patch("effect", it) })
        ShareTextButton({
            reference.behaviour(
                "defaultLights",
                JsonArray(behaviour.rows("defaultLights").filterIndexed { i, _ -> i != index }),
            )
        }) {
            AppGlyph(Glyph.Trash)
            Text("Удалить встроенный источник", color = WebPalette.Danger)
        }
    }
}
