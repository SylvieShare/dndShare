package ru.dndshare.client.ui.maps

import androidx.compose.runtime.Composable
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.ui.designsystem.*

internal fun defaultMapFireEffect() = buildJsonObject {
    put("kind", "fire")
    put("size", numbers(.22, .35))
    put("strength", .7)
    put("offset", numbers(0.0, 0.0, -.175))
}

@Composable
internal fun MapFireEffectFields(
    effect: JsonObject?,
    change: (JsonObject) -> Unit,
    begin: () -> Unit = {},
    finish: () -> Unit = {},
) {
    MapInspectorSection("Пламя") {
        ShareToggle("Показывать пламя", effect?.string("kind") == "fire") { enabled ->
            finish()
            change(
                (effect ?: defaultMapFireEffect()).with(
                    "kind",
                    JsonPrimitive(if (enabled) "fire" else "none"),
                )
            )
            finish()
        }
        if (effect?.string("kind") == "fire")
            for ((index, label, max) in
                listOf(
                    Triple(0, "Ширина пламени", 8.0),
                    Triple(1, "Высота пламени", 16.0),
                )) MapRange(
                label,
                effect.array("size").double(index),
                .02,
                maxOf(max, effect.array("size").double(index)),
                .02,
                { value ->
                    begin()
                    val size = effect.array("size").toMutableList()
                    size[index] = JsonPrimitive(value)
                    change(effect.with("size", JsonArray(size)))
                },
                finish,
            )
        if (effect != null)
            MapRange(
                "Колебания",
                effect.number("strength", .7),
                0.0,
                2.0,
                .05,
                { value ->
                    begin()
                    change(effect.with("strength", JsonPrimitive(value)))
                },
                finish,
            )
    }
}
