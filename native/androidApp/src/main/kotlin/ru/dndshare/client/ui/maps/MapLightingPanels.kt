package ru.dndshare.client.ui.maps

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import coil3.ImageLoader
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapLightingPanel(workspace: MapEditorWorkspace, images: ImageLoader) {
    val doc = workspace.map?.document ?: return
    val enabled = doc.flag("lightingEnabled")
    val sun = doc["sun"] as? JsonObject ?: newMapDocument()["sun"]!!.jsonObject
    fun patchSun(key: String, value: JsonElement, group: Boolean = false) {
        if (group) workspace.controller.beginEdit()
        workspace.controller.document { current ->
            current.with("sun", (current["sun"] as? JsonObject ?: sun).with(key, value))
        }
    }
    ShareToggle("Учитывать освещение", enabled) { v ->
        workspace.controller.document { it.with("lightingEnabled", JsonPrimitive(v)) }
    }
    MapInspectorSection("Дневное освещение") {
        ShareToggle("Дневной свет", sun.flag("enabled", true), enabled = enabled) {
            patchSun("enabled", JsonPrimitive(it))
        }
        if (enabled && sun.flag("enabled", true)) {
            MapRange(
                "Направление дневного света",
                sun.number("angle", 225.0),
                0.0,
                360.0,
                1.0,
                { patchSun("angle", JsonPrimitive(it), true) },
                workspace.controller::finishEdit,
            )
            MapRange(
                "Высота дневного света",
                sun.number("elevation", 45.0),
                10.0,
                85.0,
                1.0,
                { patchSun("elevation", JsonPrimitive(it), true) },
                workspace.controller::finishEdit,
            )
        }
    }
    MapInspectorSection("Локальные источники") {
        val shadowCount =
            doc.rows("lights").count { it.flag("enabled", true) && it.flag("shadows") }
        Text(
            "Локальных источников с тенями: $shadowCount",
            style = ShareTypography.context,
            color = WebPalette.TextMuted,
        )
        if (shadowCount > 2)
            Text(
                "Много источников с тенями могут замедлить карту.",
                style = ShareTypography.context,
                color = WebPalette.Warning,
            )
        if (doc.rows("lights").count { it.flag("enabled", true) } > 8)
            Text(
                "Одновременно отображаются до 8 локальных источников.",
                style = ShareTypography.context,
                color = WebPalette.Warning,
            )
        var open by remember { mutableStateOf(false) }
        Box {
            ShareOutlinedButton(
                { open = true },
                enabled = doc.rows("lights").count { it.string("builtinKey").isBlank() } < 32,
            ) {
                AppGlyph(Glyph.Plus)
                Text("Добавить источник")
            }
            ShareDropdownMenu(open, { open = false }) {
                listOf("torch" to "Факел", "candle" to "Свеча", "magic" to "Магический свет")
                    .forEach { (kind, name) ->
                        ShareDropdownMenuItem(
                            { Text(name) },
                            leadingIcon = { AppGlyph(Glyph.Lightbulb) },
                            onClick = {
                                open = false
                                workspace.placement.tool(MapTool.Light(kind))
                            },
                        )
                    }
            }
        }
        doc.rows("lights").forEach { light ->
            val ref = MapEntityRef(MapEntityKind.Light, light.string("id"))
            MapEntityRow(workspace, ref, images, select = { workspace.focus(ref) }) {
                MapToolButton(
                    if (light.flag("enabled", true)) "Выключить источник" else "Включить источник",
                    Glyph.Lightbulb,
                ) {
                    workspace.selection.update(
                        MapEntityKind.Light,
                        ref.id,
                        "enabled",
                        JsonPrimitive(!light.flag("enabled", true)),
                    )
                }
            }
        }
    }
}

@Composable
internal fun MapLightFields(workspace: MapEditorWorkspace, id: String, images: ImageLoader) {
    val doc = workspace.map?.document ?: return
    val source = MapEntityRef(MapEntityKind.Light, id).row(doc) ?: return
    val light = effectiveMapLight(source)
    val effect = light["effect"] as? JsonObject
    val builtin = light.string("builtinKey").isNotBlank()
    fun update(key: String, value: JsonElement, group: Boolean = false) =
        workspace.selection.update(MapEntityKind.Light, id, key, value, group)
    fun effectValue(key: String, value: JsonElement) {
        workspace.controller.beginEdit()
        workspace.controller.document { current ->
            val source = requireNotNull(MapEntityRef(MapEntityKind.Light, id).row(current))
            val e = source["effect"] as? JsonObject ?: defaultMapFireEffect()
            mapUpdateLight(current, id, "effect", e.with(key, value))
        }
    }
    val base = light.number("height") + (effect?.array("offset")?.double(2) ?: 0.0)
    if (!builtin)
        ShareTextInput(
            light.string("name"),
            { if (it.isNotBlank()) update("name", JsonPrimitive(it)) },
            "Название источника",
        )
    MapInspectorSection("Параметры света") {
        ShareColorInput(
            light.string("color", "#ffc36a"),
            { update("color", JsonPrimitive(it), true) },
            "Цвет источника",
            finish = workspace.controller::finishEdit,
        )
        MapRange(
            "Яркость",
            light.number("intensity", 8.0),
            0.0,
            50.0,
            .5,
            { update("intensity", JsonPrimitive(it), true) },
            workspace.controller::finishEdit,
        )
        MapRange(
            "Радиус света",
            light.number("radius", 4.5),
            .25,
            32.0,
            .25,
            { update("radius", JsonPrimitive(it), true) },
            workspace.controller::finishEdit,
        )
        MapRange(
            "Высота",
            base,
            maxOf(0.0, effect?.array("offset")?.double(2) ?: 0.0),
            minOf(
                maxOf(16.0, base),
                (if (builtin) 256.0 else 16.0) + (effect?.array("offset")?.double(2) ?: 0.0),
            ),
            .1,
            { value ->
                update(
                    "height",
                    JsonPrimitive(value - (effect?.array("offset")?.double(2) ?: 0.0)),
                    true,
                )
            },
            workspace.controller::finishEdit,
        )
        if (effect != null)
            MapRange(
                "Смещение источника света",
                -effect.array("offset").double(2),
                maxOf(-32.0, -base),
                minOf(32.0, (if (builtin) 256.0 else 16.0) - base),
                .05,
                { value ->
                    workspace.controller.beginEdit()
                    workspace.controller.document { current ->
                        val row = requireNotNull(MapEntityRef(MapEntityKind.Light, id).row(current))
                        val old = row["effect"]!!.jsonObject
                        val stableBase = row.number("height") + old.array("offset").double(2)
                        val next =
                            mapUpdateLight(current, id, "height", JsonPrimitive(stableBase + value))
                        mapUpdateLight(
                            next,
                            id,
                            "effect",
                            old.with(
                                "offset",
                                numbers(
                                    old.array("offset").double(0),
                                    old.array("offset").double(1),
                                    -value,
                                ),
                            ),
                        )
                    }
                },
                workspace.controller::finishEdit,
            )
        ShareToggle("Источник включён", light.flag("enabled", true)) {
            update("enabled", JsonPrimitive(it))
        }
        ShareToggle("Показывать маркер", light.flag("showMarker", true)) {
            update("showMarker", JsonPrimitive(it))
        }
        ShareToggle("Тени", light.flag("shadows")) { update("shadows", JsonPrimitive(it)) }
        ShareToggle("Мерцание", light.flag("flicker")) { update("flicker", JsonPrimitive(it)) }
    }
    MapFireEffectFields(
        effect,
        { update("effect", it, true) },
        workspace.controller::beginEdit,
        workspace.controller::finishEdit,
    )
    MapInspectorSection("Привязка") {
        val anchor = mapAnchorRef(light["anchor"] as? JsonObject)
        if (anchor == null && !builtin)
            ShareSelect(
                "Область",
                light.string("areaId"),
                listOf("" to "Без области") +
                    doc.rows("areas").map { it.string("id") to it.string("name") },
            ) { area ->
                workspace.controller.document { current ->
                    val row =
                        MapEntityRef(MapEntityKind.Light, id).row(current)
                            ?: return@document current
                    mapReplace(
                        current,
                        "lights",
                        if (area.isBlank()) row.without("areaId")
                        else row.with("areaId", JsonPrimitive(area)),
                    )
                }
            }
        if (anchor != null)
            MapEntityRow(workspace, anchor, images) {
                if (!builtin)
                    MapToolButton("Отвязать источник", Glyph.Close) {
                        workspace.controller.document {
                            mapBindLight(it, workspace.current.models, id, null)
                        }
                    }
            }
        ShareOutlinedButton(
            {
                if (workspace.currentUi.tool is MapTool.BindLight) workspace.placement.cancel()
                else workspace.placement.tool(MapTool.BindLight(id))
            },
            enabled = !builtin,
        ) {
            AppGlyph(if (builtin) Glyph.Lock else Glyph.Link)
            Text(
                if (builtin) "Привязка к модели фиксирована"
                else if (workspace.currentUi.tool is MapTool.BindLight) "Отменить привязку"
                else if (anchor == null) "Привязать" else "Изменить привязку"
            )
        }
        if (workspace.ui.tool is MapTool.BindLight)
            Text(
                "Нажмите на плитку или объект на карте.",
                style = ShareTypography.context,
                color = WebPalette.TextMuted,
            )
    }
}
