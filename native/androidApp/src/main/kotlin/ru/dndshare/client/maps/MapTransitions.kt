package ru.dndshare.client.maps

import java.util.UUID
import kotlin.math.hypot
import kotlinx.serialization.json.*

data class MapTransition(
    val key: String,
    val id: String,
    val modelId: String?,
    val label: String,
    val custom: Boolean = false,
    val returning: Boolean = false,
)

val mapTransitionLabels =
    mapOf(
        "open" to "Открыть",
        "close" to "Закрыть",
        "extinguish" to "Погасить свет",
        "ignite" to "Зажечь свет",
        "empty" to "Опустошить",
        "fill" to "Наполнить",
    )

fun mapTransitions(
    document: JsonObject,
    catalogue: Collection<MapModel>,
    kind: String,
    id: String,
): List<MapTransition> {
    val models = catalogue.associateBy { it.uuid }
    val row =
        document.rows(if (kind == "tile") "tiles" else "objects").find { it.string("id") == id }
            ?: return emptyList()
    val current = models[row.string("modelId")]
    val configured = row["transitions"] as? JsonObject
    val original = if (kind == "tile") models[configured?.string("originalModelId")] else null
    val defaults =
        listOfNotNull(original, current)
            .distinctBy { it.uuid }
            .flatMap { source ->
                source.behaviour.rows("transitions").map { edge ->
                    val target = catalogue.find {
                        !it.hidden && it.id == edge.string("toDefinitionId")
                    }
                    MapTransition(
                        "catalogue:${source.uuid}:${edge.string("id")}",
                        edge.string("id"),
                        target?.uuid,
                        mapTransitionLabels[edge.string("action")] ?: edge.string("action"),
                    )
                }
            }
            .distinctBy { it.modelId to it.label }
    val custom =
        if (kind == "tile")
            configured?.rows("targets").orEmpty().map {
                MapTransition(
                    "custom:${it.string("id")}",
                    it.string("id"),
                    it.string("modelId").ifBlank { null },
                    "Перейти",
                    custom = true,
                )
            }
        else emptyList()
    val returning =
        if (original != null && original.uuid != current?.uuid)
            listOf(MapTransition("return", "return", original.uuid, "Вернуться", returning = true))
        else emptyList()
    val result = linkedMapOf<String, MapTransition>()
    for (edge in defaults + custom + returning) {
        if (edge.modelId == current?.uuid) continue
        val key = edge.modelId ?: edge.key
        val old = result[key]
        fun priority(value: MapTransition) = if (value.custom) 2 else if (value.returning) 0 else 1
        if (old == null || priority(edge) > priority(old)) result[key] = edge
    }
    return result.values.toList()
}

fun mapSetTransition(
    document: JsonObject,
    id: String,
    transitionId: String?,
    modelId: String?,
): JsonObject {
    val tile = requireNotNull(document.rows("tiles").find { it.string("id") == id })
    var state =
        tile["transitions"] as? JsonObject
            ?: buildJsonObject {
                put("originalModelId", tile.string("modelId"))
                put("targets", JsonArray(emptyList()))
            }
    val targets = state.rows("targets").toMutableList()
    if (transitionId == null) {
        require(targets.size < 32) { "Не более 32 переходов плитки" }
        targets += buildJsonObject {
            put("id", UUID.randomUUID().toString())
            modelId?.let { put("modelId", it) }
        }
    } else if (modelId == null) targets.removeAll { it.string("id") == transitionId }
    else {
        require(
            modelId != tile.string("modelId") &&
                targets.none { it.string("id") != transitionId && it.string("modelId") == modelId }
        )
        val index = targets.indexOfFirst { it.string("id") == transitionId }
        require(index >= 0)
        targets[index] = targets[index].with("modelId", JsonPrimitive(modelId))
    }
    state = state.with("targets", JsonArray(targets))
    return mapReplace(document, "tiles", tile.with("transitions", state))
}

fun mapApplyTransition(
    document: JsonObject,
    catalogue: Collection<MapModel>,
    kind: String,
    id: String,
    key: String,
): JsonObject {
    val transition =
        requireNotNull(mapTransitions(document, catalogue, kind, id).find { it.key == key }) {
            "Переход отсутствует"
        }
    val target =
        requireNotNull(
            catalogue.find {
                it.uuid == transition.modelId && !it.hidden && it.isObject == (kind == "object")
            }
        ) {
            "Целевая модель недоступна"
        }
    val list = if (kind == "tile") "tiles" else "objects"
    val row = requireNotNull(document.rows(list).find { it.string("id") == id })
    val source = requireNotNull(catalogue.find { it.uuid == row.string("modelId") })
    var changed = row.with("modelId", JsonPrimitive(target.uuid))
    if (kind == "tile" && changed["transitions"] == null)
        changed =
            changed.with(
                "transitions",
                buildJsonObject {
                    put("originalModelId", source.uuid)
                    put("targets", JsonArray(emptyList()))
                },
            )
    var next = mapReplace(document, list, changed)
    val context = MapContext(next, catalogue)
    if (kind == "tile") {
        val used = mutableSetOf<Int>()
        next =
            next.with(
                "objects",
                JsonArray(
                    next.rows("objects").map { item ->
                        val anchor = item["placement"] as? JsonObject
                        if (anchor?.string("tileId") != id) item
                        else {
                            require(target.canStand && target.placementPoints.isNotEmpty()) {
                                "На новой модели нет точек для размещённых объектов"
                            }
                            val previous =
                                source.placementPoints.getOrNull(anchor.number("point").toInt())
                                    as? JsonObject ?: error("Исходная точка размещения отсутствует")
                            val index =
                                target.placementPoints.indices
                                    .filter { it !in used }
                                    .minWithOrNull(
                                        compareBy<Int> {
                                                val p = target.placementPoints[it].jsonObject
                                                hypot(
                                                    p.number("x") - previous.number("x"),
                                                    p.number("y") - previous.number("y"),
                                                )
                                            }
                                            .thenBy { it }
                                    ) ?: error("На новой модели недостаточно точек размещения")
                            used += index
                            val pose =
                                mapSurface(
                                    changed,
                                    target,
                                    target.placementPoints[index].jsonObject,
                                    context.placements[id]?.elevation ?: 0.0,
                                )
                            item
                                .with("placement", anchor.with("point", JsonPrimitive(index)))
                                .with("x", JsonPrimitive(pose.x))
                                .with("y", JsonPrimitive(pose.y))
                                .with("elevation", JsonPrimitive(pose.elevation))
                        }
                    }
                ),
            )
    }
    next =
        next.with(
            "lights",
            JsonArray(
                next.rows("lights").filter {
                    val anchor = it["anchor"] as? JsonObject
                    anchor?.string("kind") != kind || anchor.string("id") != id
                }
            ),
        )
    return normalizeMapDocument(next, catalogue)
}
