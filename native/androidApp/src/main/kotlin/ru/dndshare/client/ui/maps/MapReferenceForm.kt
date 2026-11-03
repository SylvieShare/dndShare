package ru.dndshare.client.ui.maps

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.*
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import java.util.UUID
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.MapAssetCache
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapReferenceForm(workspace: MapEditorWorkspace, cache: MapAssetCache) {
    val reference = workspace.reference
    val draft = reference.draft ?: return
    val model = reference.model ?: return
    val behaviour = draft.current["behaviour"] as? JsonObject ?: buildJsonObject {}
    LazyColumn(
        Modifier.fillMaxSize().semantics { paneTitle = "Параметры модели" },
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        item {
            Text("${model.raw.string("sourceCode")} · ${model.name}", style = ShareTypography.group)
        }
        item {
            MapInspectorSection("Исходные данные") {
                for ((title, value) in
                    listOf(
                        "Коллекция" to "${model.collectionName} · ${model.collection}",
                        "ID" to model.id,
                        "UUID" to model.uuid,
                        "Исходный файл" to model.raw.string("sourceCode"),
                        "Исходное имя" to model.raw.string("sourceName"),
                    )) Text("$title: $value", style = ShareTypography.context)
                Text(
                    "Изменения модели применяются во всех картах и сессиях.",
                    color = WebPalette.Warning,
                    style = ShareTypography.context,
                )
            }
        }
        item { MapReferencePreview(workspace, cache) }
        item { MapReferenceCoreFields(reference) }
        item { MapReferenceGeometry(reference) }
        item {
            MapInspectorSection("Пазы (${draft.current.rows("supportSlots").size})") {
                Text(
                    "Пазы принимают опирающиеся на модель плитки и выступы.",
                    style = ShareTypography.context,
                )
                ShareOutlinedButton(
                    { addReferenceSlot(reference) },
                    enabled = draft.current.rows("supportSlots").size < 64,
                ) {
                    AppGlyph(Glyph.Plus)
                    Text("Добавить паз")
                }
            }
        }
        items(draft.current.rows("supportSlots").size) { index ->
            MapReferenceSlot(reference, index)
        }
        item {
            MapInspectorSection(
                "Места размещения (${draft.current.rows("placementPoints").size})"
            ) {
                ShareOutlinedButton(
                    { addReferencePoint(reference) },
                    enabled = draft.current.rows("placementPoints").size < 256,
                ) {
                    AppGlyph(Glyph.Plus)
                    Text("Добавить место")
                }
            }
        }
        items(draft.current.rows("placementPoints").size) { index ->
            MapReferencePoint(reference, index)
        }
        item {
            MapInspectorSection("Контуры препятствий") {
                Text(
                    "Полигоны в координатах тайла: [[[x, y], [x, y], [x, y]]]. Точки должны находиться в занимаемых клетках.",
                    style = ShareTypography.context,
                )
                ShareTextInput(
                    draft.blockers,
                    { text ->
                        workspace.controller.ui { ui ->
                            ui.copy(reference = ui.reference?.copy(blockers = text))
                        }
                    },
                    "Контуры препятствий",
                    multiline = true,
                )
            }
        }
        item { MapReferenceWater(reference) }
        item {
            MapInspectorSection("Переходы (${behaviour.rows("transitions").size})") {
                ShareOutlinedButton(
                    {
                        val targets =
                            workspace.models.filter {
                                !it.hidden && it.id != model.id && it.isObject == model.isObject
                            }
                        reference.behaviour(
                            "transitions",
                            JsonArray(
                                behaviour.rows("transitions") +
                                    buildJsonObject {
                                        put("id", UUID.randomUUID().toString())
                                        put("action", "open")
                                        put("toDefinitionId", targets.firstOrNull()?.id.orEmpty())
                                    }
                            ),
                        )
                    },
                    enabled = behaviour.rows("transitions").size < 32,
                ) {
                    AppGlyph(Glyph.Plus)
                    Text("Добавить переход")
                }
            }
        }
        items(behaviour.rows("transitions").size) {
            MapReferenceTransition(reference, it, workspace.models)
        }
        item {
            MapInspectorSection("Встроенный свет (${behaviour.rows("defaultLights").size})") {
                ShareOutlinedButton(
                    {
                        reference.behaviour(
                            "defaultLights",
                            JsonArray(
                                behaviour.rows("defaultLights") +
                                    buildJsonObject {
                                        put("key", UUID.randomUUID().toString().take(8))
                                        put("name", "Свет")
                                        put("kind", "torch")
                                        put("color", "#ffc36a")
                                        put(
                                            "position",
                                            numbers(
                                                draft.current.number("width", 1.0) / 2,
                                                draft.current.number("height", 1.0) / 2,
                                                (draft.current.number("maxHeight") -
                                                        draft.current.number("mountDepth"))
                                                    .coerceAtLeast(0.0) + .1,
                                            ),
                                        )
                                        put("intensity", 8)
                                        put("radius", 4.5)
                                        put("enabled", true)
                                        put("flicker", true)
                                    }
                            ),
                        )
                    },
                    enabled = behaviour.rows("defaultLights").size < 8,
                ) {
                    AppGlyph(Glyph.Plus)
                    Text("Добавить встроенный источник")
                }
            }
        }
        items(behaviour.rows("defaultLights").size) { MapReferenceLight(reference, it) }
    }
}
