package ru.dndshare.client.maps

import java.util.UUID
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import ru.dndshare.client.model.WireJson

/** The document stays lossless: fields not yet edited on Android survive every save. */
@Serializable
data class BattleMap(
    val id: String = "",
    val name: String = "Новая карта",
    val document: JsonObject = newMapDocument(),
    val revision: Long = 0,
    val changedAt: String = "",
    val publishedAt: String? = null,
    val owned: Boolean = true,
    val subscribed: Boolean = false,
    val author: String = "",
    val previewUrl: String? = null,
    val width: Double = 0.0,
    val height: Double = 0.0,
    val tileCount: Int = 0,
    val objectCount: Int = 0,
    val tags: List<String> = emptyList(),
    val rating: Double = 0.0,
    val ratingCount: Int = 0,
    val myRating: Int = 0,
) {
    val editable: Boolean
        get() = owned && publishedAt == null

    val content: JsonObject
        get() = buildJsonObject {
            put("name", name)
            put("document", document)
        }

    fun withContent(value: JsonObject) =
        copy(
            name = value.string("name"),
            document = value.getValue("document").jsonObject,
        )
}

@Serializable
data class MapModel(
    val id: String,
    val uuid: String,
    val name: String,
    val collection: String = "",
    val collectionName: String = "",
    val category: String = "",
    val tileType: String = "",
    val canStand: Boolean = false,
    val width: Int = 1,
    val height: Int = 1,
    val mountDepth: Double = 0.0,
    val mountProfile: String = "",
    val placementOffset: List<Double> = emptyList(),
    val renderUrl: String = "",
    val lodUrl: String = "",
    val previewUrl: String = "",
    val hidden: Boolean = false,
    val behaviour: JsonObject = JsonObject(emptyMap()),
    val supportSlots: JsonArray = JsonArray(emptyList()),
    val placementPoints: JsonArray = JsonArray(emptyList()),
) {
    val isObject
        get() = tileType == "object"
}

@Serializable
data class MapPatch(
    val op: String = "set",
    val path: List<JsonElement>,
    val value: JsonElement = JsonNull,
    val idField: String? = null,
    val beforeId: JsonElement? = null,
)

@Serializable
data class MapPacket(val baseVersion: Long, val mutationId: String, val patches: List<MapPatch>)

@Serializable
data class MapChange(
    val version: Long,
    val patches: List<MapPatch> = emptyList(),
    val data: JsonObject? = null,
    val metadata: JsonObject = JsonObject(emptyMap()),
)

@Serializable data class MapHistoryStep(val forward: List<MapPatch>, val inverse: List<MapPatch>)

@Serializable
data class MapWork(
    val key: String = UUID.randomUUID().toString(),
    val confirmed: BattleMap = BattleMap(),
    val current: BattleMap = confirmed,
    val sending: MapPacket? = null,
    val sent: JsonObject? = null,
    val undo: List<MapHistoryStep> = emptyList(),
    val redo: List<MapHistoryStep> = emptyList(),
    val localVersion: Long = 0,
    val localFormat: Int = 1,
) {
    init {
        require(localFormat == 1) { "Неизвестный формат локального черновика карты" }
    }

    val dirty
        get() = sending != null || current.content != confirmed.content
}

private val emptyMapDocument: JsonObject =
    WireJson.parseToJsonElement(
            """{
    "version":2,"kind":"tiles","tags":[],"width":30,"height":22,
    "grid":{"visible":true},"tiles":[],"objects":[],"zones":[],"areas":[],
    "lightingEnabled":false,"sun":{"enabled":true,"angle":225,"elevation":45},"lights":[]
}"""
        )
        .jsonObject

fun newMapDocument(): JsonObject = emptyMapDocument

internal fun JsonObject.string(key: String, default: String = "") =
    (get(key) as? JsonPrimitive)?.contentOrNull ?: default

internal fun JsonObject.number(key: String, default: Double = 0.0) =
    (get(key) as? JsonPrimitive)?.doubleOrNull ?: default

internal fun JsonObject.flag(key: String, default: Boolean = false) =
    (get(key) as? JsonPrimitive)?.booleanOrNull ?: default

internal fun JsonObject.rows(key: String) =
    (get(key) as? JsonArray).orEmpty().mapNotNull { it as? JsonObject }

internal fun JsonObject.with(key: String, value: JsonElement) =
    JsonObject(toMutableMap().apply { put(key, value) })

fun mapAcknowledge(work: MapWork, reply: MapChange): MapWork {
    val packet = requireNotNull(work.sending)
    require(reply.version >= packet.baseVersion)
    val accepted = reply.data ?: mapApply(work.confirmed.content, reply.patches)
    val editsDuringRequest = mapDiff(requireNotNull(work.sent), work.current.content)
    val metadata = reply.metadata
    val confirmed =
        work.confirmed
            .withContent(accepted)
            .copy(
                revision = reply.version,
                changedAt = metadata.string("changedAt", work.confirmed.changedAt),
            )
    return work.copy(
        confirmed = confirmed,
        current = confirmed.withContent(mapApply(accepted, editsDuringRequest)),
        sending = null,
        sent = null,
    )
}
