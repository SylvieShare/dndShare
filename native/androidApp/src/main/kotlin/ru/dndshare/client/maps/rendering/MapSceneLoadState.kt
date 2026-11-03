package ru.dndshare.client.maps.rendering

import ru.dndshare.client.maps.MapEntityRef

/** Immutable renderer-thread snapshot; a ready URL refers to the actual displayed quality. */
data class MapSceneLoadState(
    val readyRefs: Set<MapEntityRef> = emptySet(),
    val readyUrls: Set<String> = emptySet(),
    val pendingUrls: Set<String> = emptySet(),
    val failures: Map<String, MapSceneLoadFailure> = emptyMap(),
    val problem: String? = null,
)

data class MapSceneLoadFailure(
    val message: String,
    val stage: String,
    val attempt: Int = 1,
    val retrying: Boolean = false,
    val status: Int? = null,
    val total: Long? = null,
    val url: String? = null,
)
