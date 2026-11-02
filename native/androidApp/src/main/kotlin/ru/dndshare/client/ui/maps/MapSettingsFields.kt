package ru.dndshare.client.ui.maps

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapSettingsFields(map: BattleMap, controller: MapEditorController) {
    var width by
        rememberSaveable(map.id) { mutableStateOf(map.document.number("width").toInt().toString()) }
    var height by
        rememberSaveable(map.id) {
            mutableStateOf(map.document.number("height").toInt().toString())
        }
    var resize by remember { mutableStateOf(false) }
    ShareTextInput(
        map.name,
        { name -> if (name.isNotBlank()) controller.change { it.copy(name = name) } },
        "Название карты",
    )
    val tags = (map.document["tags"] as? JsonArray).orEmpty().map { it.jsonPrimitive.content }
    ShareTextInput(
        tags.joinToString(", "),
        { text ->
            val values =
                text
                    .split(',')
                    .map { it.trim().take(64) }
                    .filter { it.isNotBlank() }
                    .distinctBy { it.lowercase() }
                    .take(32)
            controller.document { it.with("tags", JsonArray(values.map(::JsonPrimitive))) }
        },
        "Теги через запятую",
    )
    ShareNumberInput("Ширина", width, change = { width = it })
    ShareNumberInput("Высота", height, change = { height = it })
    val w = width.toIntOrNull()
    val h = height.toIntOrNull()
    ShareOutlinedButton(
        { resize = true },
        enabled = w != null && h != null && w in 2..160 && h in 2..160 && w * h <= 16000,
    ) {
        Text("Изменить размер")
    }
    ShareToggle("Сетка", (map.document["grid"] as? JsonObject)?.flag("visible") ?: true) { value ->
        controller.document { it.with("grid", buildJsonObject { put("visible", value) }) }
    }
    if (resize)
        ShareAlertDialog(
            onDismissRequest = { resize = false },
            title = { Text("Изменить размер карты?") },
            text = { Text("Элементы за новыми границами будут убраны. Действие можно отменить.") },
            confirmButton = {
                ShareTextButton({
                    controller.document { doc ->
                        val models = controller.state.value.models.associateBy { it.uuid }
                        val removed =
                            doc.rows("tiles")
                                .filter { tile ->
                                    val model = models[tile.string("modelId")]
                                    val size = model?.let { mapFootprint(tile, it) } ?: (1 to 1)
                                    tile.number("x") + size.first > requireNotNull(w) ||
                                        tile.number("y") + size.second > requireNotNull(h)
                                }
                                .map { it.string("id") }
                                .toSet()
                        val clean = mapRemove(doc, models, removed)
                        clean
                            .with("width", JsonPrimitive(requireNotNull(w)))
                            .with("height", JsonPrimitive(requireNotNull(h)))
                    }
                    resize = false
                }) {
                    Text("Изменить")
                }
            },
            dismissButton = { ShareTextButton({ resize = false }) { Text("Отмена") } },
        )
}

@Composable
internal fun MapAreasPanel(map: BattleMap, controller: MapEditorController) {
    ShareOutlinedButton({
        controller.document { doc ->
            val area = buildJsonObject {
                put("id", java.util.UUID.randomUUID().toString())
                put("name", "Новая область")
                put("color", "#a98aff")
                put("hidden", false)
                put("fog", false)
                put("tileIds", JsonArray(emptyList()))
                put("objectIds", JsonArray(emptyList()))
            }
            doc.with("areas", JsonArray(doc.rows("areas") + area))
        }
    }) {
        AppGlyph(Glyph.Plus)
        Text("Добавить область")
    }
    map.document.rows("areas").forEach { area ->
        ShareTile(framed = false) {
            fun set(key: String, value: JsonElement) {
                controller.document { mapReplace(it, "areas", area.with(key, value)) }
            }
            ShareTextInput(
                area.string("name"),
                { if (it.isNotBlank()) set("name", JsonPrimitive(it)) },
                "Название области",
            )
            ShareTextInput(
                area.string("color"),
                { if (it.matches(Regex("#[0-9a-fA-F]{6}"))) set("color", JsonPrimitive(it)) },
                "Цвет",
            )
            ShareToggle("Скрыть область", area.flag("hidden")) { set("hidden", JsonPrimitive(it)) }
            ShareToggle("Туман", area.flag("fog")) { set("fog", JsonPrimitive(it)) }
            Text(
                "Плитки: ${(area["tileIds"] as? JsonArray)?.size ?: 0} · Объекты: ${(area["objectIds"] as? JsonArray)?.size ?: 0}",
                style = ShareTypography.context,
            )
            ShareTextButton({
                controller.document {
                    it.with(
                        "areas",
                        JsonArray(
                            it.rows("areas").filter { row -> row.string("id") != area.string("id") }
                        ),
                    )
                }
            }) {
                Text("Удалить область", color = WebPalette.Danger)
            }
        }
    }
}

@Composable
internal fun MapLightPanel(map: BattleMap, controller: MapEditorController) {
    ShareToggle("Освещение", map.document.flag("lightingEnabled")) { value ->
        controller.document { it.with("lightingEnabled", JsonPrimitive(value)) }
    }
    val sun =
        map.document["sun"] as? JsonObject
            ?: buildJsonObject {
                put("enabled", true)
                put("angle", 225)
                put("elevation", 45)
            }
    ShareToggle("Солнце", sun.flag("enabled", true)) { value ->
        controller.document { it.with("sun", sun.with("enabled", JsonPrimitive(value))) }
    }
    ShareNumberInput("Направление солнца", sun.number("angle").toInt().toString()) { value ->
        value
            .toIntOrNull()
            ?.takeIf { it in 0..360 }
            ?.let { number ->
                controller.document { it.with("sun", sun.with("angle", JsonPrimitive(number))) }
            }
    }
    ShareNumberInput("Высота солнца", sun.number("elevation").toInt().toString()) { value ->
        value
            .toIntOrNull()
            ?.takeIf { it in 10..85 }
            ?.let { number ->
                controller.document { it.with("sun", sun.with("elevation", JsonPrimitive(number))) }
            }
    }
    map.document.rows("lights").forEach { light ->
        ShareTile(framed = false) {
            Text(light.string("name"), style = ShareTypography.group)
            ShareToggle("Включён", light.flag("enabled", true)) { value ->
                controller.document {
                    mapReplace(it, "lights", light.with("enabled", JsonPrimitive(value)))
                }
            }
            ShareToggle("Тени", light.flag("shadows")) { value ->
                val updated =
                    if (light.string("builtinKey").isNotBlank())
                        light.with(
                            "overrides",
                            (light["overrides"] as? JsonObject ?: buildJsonObject {}).with(
                                "shadows",
                                JsonPrimitive(value),
                            ),
                        )
                    else light
                controller.document {
                    mapReplace(it, "lights", updated.with("shadows", JsonPrimitive(value)))
                }
            }
        }
    }
}
