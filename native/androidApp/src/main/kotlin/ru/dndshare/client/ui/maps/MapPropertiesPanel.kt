package ru.dndshare.client.ui.maps

import androidx.compose.material3.Text
import androidx.compose.runtime.*
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapPropertiesPanel(workspace: MapEditorWorkspace, api: MapsApi) {
    val map = workspace.map ?: return
    val doc = map.document
    var pendingSize by remember { mutableStateOf<Pair<Int, Int>?>(null) }
    var knownTags by remember { mutableStateOf<List<String>>(emptyList()) }
    LaunchedEffect(api) {
        runCatching {
            coroutineScope {
                val own = async { api.list("own") }
                val subscriptions = async { api.list("subscriptions") }
                (own.await() + subscriptions.await())
                    .flatMap { it.tags }
                    .distinctBy { it.lowercase() }
            }
        }
            .onSuccess { knownTags = it }
    }
    MapInspectorSection("Последнее сохранение") {
        Text(
            map.changedAt.ifBlank { "Ещё не сохранялась" },
            style = ShareTypography.context,
            color = WebPalette.TextMuted,
        )
    }
    ShareToggle("Показывать точки в пазах", workspace.ui.showAnchors) { show ->
        workspace.controller.ui { it.copy(showAnchors = show) }
    }
    ShareTextInput(
        map.name,
        {
            if (it.isNotBlank() && it.length <= 160)
                workspace.controller.change { m -> m.copy(name = it) }
        },
        "Название карты",
    )
    ShareTokenInput(
        doc.array("tags").map { it.jsonPrimitive.content },
        { tags ->
            workspace.controller.document { it.with("tags", JsonArray(tags.map(::JsonPrimitive))) }
        },
        "Теги карты",
        knownTags,
        allowCreate = true,
    )
    fun resize(width: Int, height: Int) {
        val boundedHeight = height.coerceIn(2, 160)
        val w = width.coerceIn(2, minOf(160, 16000 / boundedHeight))
        val h = boundedHeight.coerceIn(2, minOf(160, 16000 / w))
        if (w < doc.number("width") || h < doc.number("height")) pendingSize = w to h
        else workspace.controller.document { resizeMap(it, workspace.current.models, w, h) }
    }
    ShareNumberInput("Ширина", doc.number("width").toInt().toString()) {
        it.toIntOrNull()?.let { w -> resize(w, doc.number("height").toInt()) }
    }
    ShareNumberInput("Высота", doc.number("height").toInt().toString()) {
        it.toIntOrNull()?.let { h -> resize(doc.number("width").toInt(), h) }
    }
    ShareToggle("Показывать сетку", (doc["grid"] as? JsonObject)?.flag("visible", true) ?: true) {
        visible ->
        workspace.controller.document {
            it.with(
                "grid",
                (it["grid"] as? JsonObject ?: buildJsonObject {}).with(
                    "visible",
                    JsonPrimitive(visible),
                ),
            )
        }
    }
    pendingSize?.let { (width, height) ->
        ShareAlertDialog(
            onDismissRequest = { pendingSize = null },
            title = { Text("Уменьшить карту?") },
            text = {
                Text(
                    "Клетки и объекты за новой границей будут удалены. Действие можно отменить в редакторе."
                )
            },
            confirmButton = {
                ShareTextButton({
                    workspace.controller.document {
                        resizeMap(it, workspace.current.models, width, height)
                    }
                    pendingSize = null
                }) {
                    Text("Изменить размер")
                }
            },
            dismissButton = { ShareTextButton({ pendingSize = null }) { Text("Отмена") } },
        )
    }
}
