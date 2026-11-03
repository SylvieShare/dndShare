package ru.dndshare.client.maps

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable
enum class MapEntityKind(val wire: String, val collection: String) {
    @SerialName("tile") Tile("tile", "tiles"),
    @SerialName("object") Object("object", "objects"),
    @SerialName("light") Light("light", "lights"),
    @SerialName("decal") Decal("decal", "decals"),
    @SerialName("area") Area("area", "areas"),
    @SerialName("camera") Camera("camera", "cameras");

    companion object {
        fun fromWire(value: String) = entries.find { it.wire == value }
    }
}

/** IDs are unique within a collection, not across the document. */
@Serializable
data class MapEntityRef(val kind: MapEntityKind, val id: String) {
    val key
        get() = "${kind.wire}:$id"

    fun row(document: JsonObject) = document.rows(kind.collection).find { it.string("id") == id }
}

fun mapAnchorRef(anchor: JsonObject?): MapEntityRef? {
    val kind = MapEntityKind.fromWire(anchor?.string("kind").orEmpty()) ?: return null
    val id = anchor?.string("id").orEmpty()
    return if (id.isBlank()) null else MapEntityRef(kind, id)
}

@Serializable
data class MapFocus(
    val selected: List<MapEntityRef> = emptyList(),
    val entity: MapEntityRef? = null,
)

@Serializable
sealed interface MapTool {
    @Serializable @SerialName("none") data object None : MapTool

    @Serializable @SerialName("model") data class Model(val modelId: String) : MapTool

    @Serializable @SerialName("light") data class Light(val preset: String) : MapTool

    @Serializable @SerialName("decal") data class Decal(val image: MapDecalImage) : MapTool

    @Serializable
    @SerialName("paste")
    data class Paste(val payload: MapClipboard, val pivot: MapPose) : MapTool

    @Serializable @SerialName("bind") data class BindLight(val id: String) : MapTool

    @Serializable @SerialName("move-decal") data class MoveDecal(val id: String) : MapTool
}

/** Private workspace state; never sent to Go and never placed in an Activity Bundle. */
@Serializable
data class MapEditorUi(
    val panel: String = "tiles",
    val camera: ru.dndshare.client.maps.rendering.MapCamera? = null,
    val referenceOpen: Boolean = false,
    val sidebarOpen: Boolean? = null,
    val focusOpen: Boolean = true,
    val focus: MapFocus = MapFocus(),
    val back: List<MapFocus> = emptyList(),
    val tool: MapTool = MapTool.None,
    val rotation: Int = 0,
    val mirrored: Boolean = false,
    val repeatPlacement: Boolean = false,
    val fillRoom: Boolean = false,
    val multiple: Boolean = false,
    val rectangle: Boolean = false,
    val orbit: Boolean = false,
    val collection: String = "",
    val category: String = "floor",
    val contentFilter: String = "all",
    val lightFilter: String = "all",
    val showAnchors: Boolean = false,
    val showCameras: Boolean = true,
    val clipboard: MapClipboard? = null,
    val reference: MapReferenceDraft? = null,
    val referenceKind: String = "tile",
)
