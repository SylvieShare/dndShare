package ru.dndshare.client.ui.maps

import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*

/**
 * Surface queries have an independent cancellation token; later pointer previews cannot accept an
 * old hit.
 */
internal class MapSurfacePlacement(private val workspace: MapEditorWorkspace) {
    private var sequence = 0L

    fun cancel() {
        sequence++
    }

    fun place(pointer: MapPointer, tool: MapTool) {
        val request = ++sequence
        val scene = workspace.scene ?: return
        workspace.hint = "Выбираем поверхность…"
        scene.pickSurface(pointer.x, pointer.y) { hit ->
            if (request != sequence || workspace.currentUi.tool != tool) return@pickSurface
            workspace.hint = null
            if (hit == null) {
                workspace.controller.notice("Выберите поверхность плитки или объекта")
                return@pickSurface
            }
            var id = ""
            val accepted =
                workspace.controller.document { doc ->
                    val owner = requireNotNull(hit.owner.row(doc)) { "Опора уже удалена" }
                    require(owner.string("modelId") == hit.modelId) {
                        "Модель опоры изменилась; выберите поверхность ещё раз"
                    }
                    val anchor = buildJsonObject {
                        put("kind", hit.owner.kind.wire)
                        put("id", hit.owner.id)
                    }
                    val row =
                        when (tool) {
                            is MapTool.Decal ->
                                newMapDecal(
                                        tool.image,
                                        hit.owner.kind.wire,
                                        hit.owner.id,
                                        hit.local,
                                        hit.normal,
                                    )
                                    .with("rotation", JsonPrimitive(workspace.currentUi.rotation))
                                    .also { id = it.string("id") }
                            is MapTool.MoveDecal -> {
                                id = tool.id
                                val original =
                                    requireNotNull(MapEntityRef(MapEntityKind.Decal, id).row(doc))
                                original
                                    .with("anchor", anchor)
                                    .with(
                                        "position",
                                        numbers(
                                            hit.local.x.toDouble(),
                                            hit.local.y.toDouble(),
                                            hit.local.z.toDouble(),
                                        ),
                                    )
                                    .with(
                                        "normal",
                                        numbers(
                                            hit.normal.x.toDouble(),
                                            hit.normal.y.toDouble(),
                                            hit.normal.z.toDouble(),
                                        ),
                                    )
                            }
                            else -> error("Неверный инструмент поверхности")
                        }
                    if (tool is MapTool.Decal)
                        doc.with("decals", JsonArray(doc.rows("decals") + row))
                    else mapReplace(doc, "decals", row)
                }
            if (accepted && !(tool is MapTool.Decal && workspace.currentUi.repeatPlacement))
                workspace.focus(MapEntityRef(MapEntityKind.Decal, id))
        }
    }
}
