package ru.dndshare.client.maps.rendering

import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*

/** Preferred quality is recomputed only after a document, tier or detail selection changes. */
internal class MapSceneQuality {
    private var source: List<MapSceneEntry>? = null
    private var tier: MapModelTier? = null
    private var force = false
    private var details = emptySet<MapEntityRef>()
    private var preferred = emptyList<MapSceneEntry>()

    fun entries(
        document: JsonObject,
        value: List<MapSceneEntry>,
        tier: MapModelTier,
        forceLod: Boolean,
        detailRefs: Set<MapEntityRef>,
    ): List<MapSceneEntry> {
        if (source === value && this.tier == tier && force == forceLod && details == detailRefs)
            return preferred
        source = value
        this.tier = tier
        force = forceLod
        details = detailRefs.toSet()
        val tiles = detailRefs.filter { it.kind == MapEntityKind.Tile }.map { it.id }.toSet()
        val attached =
            document
                .rows("objects")
                .filter { (it["placement"] as? JsonObject)?.string("tileId") in tiles }
                .map { MapEntityRef(MapEntityKind.Object, it.string("id")) }
                .toSet()
        val models = mutableMapOf<Pair<String, String>, MapModel>()
        preferred = value.map { entry ->
            val detailed = entry.ref in detailRefs || entry.ref in attached
            val lod = forceLod || tier == MapModelTier.Lod && !detailed
            val url =
                if (lod) entry.model.lodUrl.ifBlank { entry.model.renderUrl }
                else entry.model.renderUrl
            if (url == entry.model.renderUrl) entry
            else
                entry.copy(
                    model =
                        models.getOrPut(entry.model.uuid to url) {
                            entry.model.copy(renderUrl = url)
                        }
                )
        }
        return preferred
    }
}

/** Fast geometry starts first; a ready preferred pool makes its temporary fallback unnecessary. */
internal fun mapAssetRequests(
    entries: List<MapSceneEntry>,
    ready: (String) -> Boolean,
): Map<String, List<MapSceneEntry>> {
    val plan = linkedMapOf<String, MutableList<MapSceneEntry>>()
    for (entry in entries) {
        val lod = entry.model.lodUrl
        if (lod.isNotBlank() && lod != entry.model.renderUrl && !ready(entry.model.renderUrl))
            plan.getOrPut(lod) { mutableListOf() }.add(entry)
    }
    for (entry in entries) plan.getOrPut(entry.model.renderUrl) { mutableListOf() }.add(entry)
    return plan
}
