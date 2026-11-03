package ru.dndshare.client.maps

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import ru.dndshare.client.model.WireJson

fun decodeMapModel(raw: JsonObject): MapModel {
    val fields = raw.toMutableMap()
    for (key in listOf("supportSlots", "placementPoints", "placementOffset")) if (
        fields[key] == JsonNull
    )
        fields[key] = JsonArray(emptyList())
    if (fields["behaviour"] == JsonNull) fields["behaviour"] = JsonObject(emptyMap())
    return WireJson.decodeFromJsonElement<MapModel>(JsonObject(fields)).copy(raw = raw)
}

fun editableMapModel(model: MapModel): JsonObject {
    val all = WireJson.encodeToJsonElement(MapModel.serializer(), model).jsonObject + model.raw
    val keys =
        setOf(
            "id",
            "uuid",
            "code",
            "variantCode",
            "collection",
            "collectionName",
            "sourceCode",
            "sourceName",
            "name",
            "nameEn",
            "groupName",
            "groupNameEn",
            "category",
            "textureDetail",
            "tileType",
            "hasDecor",
            "canStand",
            "hidden",
            "placementPoints",
            "wallMode",
            "wallMask",
            "width",
            "height",
            "placementOffset",
            "mountDepth",
            "mountProfile",
            "surfaceHeight",
            "maxHeight",
            "baseSize",
            "referenceDiameter",
            "blockers",
            "tags",
            "supportSlots",
        )
    val fields = all.filterKeys { it in keys }.toMutableMap()
    for (key in listOf("blockers", "tags", "supportSlots", "placementPoints")) if (
        fields[key] == null || fields[key] == JsonNull
    )
        fields[key] = JsonArray(emptyList())
    if ((fields["placementOffset"] as? JsonArray)?.size != 2)
        fields["placementOffset"] = numbers(0.0, 0.0)
    fields["behaviour"] =
        model.behaviour.takeIf { it.isNotEmpty() }
            ?: buildJsonObject {
                put("revision", 1)
                put("defaultLights", JsonArray(emptyList()))
                put("transitions", JsonArray(emptyList()))
            }
    return JsonObject(fields)
}

@Serializable
data class MapReferenceDraft(
    val modelId: String,
    val base: JsonObject,
    val current: JsonObject = base,
    val blockers: String = (base["blockers"] ?: JsonArray(emptyList())).toString(),
    val invalidNumbers: Map<String, String> = emptyMap(),
) {
    val dirty
        get() =
            current != base ||
                invalidNumbers.isNotEmpty() ||
                blockers != (base["blockers"] ?: JsonArray(emptyList())).toString()

    fun payload(): JsonObject {
        require(invalidNumbers.isEmpty()) {
            "Проверьте числовые поля: ${invalidNumbers.keys.joinToString()}"
        }
        val contours =
            WireJson.parseToJsonElement(blockers) as? JsonArray
                ?: error("Контуры должны содержать полигоны из точек [x, y]")
        require(
            contours.all { polygon ->
                polygon is JsonArray &&
                    polygon.all { point ->
                        point is JsonArray &&
                            point.size == 2 &&
                            point.all { it.jsonPrimitive.doubleOrNull?.isFinite() == true }
                    }
            }
        ) {
            "Контуры должны содержать полигоны из точек [x, y]"
        }
        return current.with("blockers", contours)
    }
}
