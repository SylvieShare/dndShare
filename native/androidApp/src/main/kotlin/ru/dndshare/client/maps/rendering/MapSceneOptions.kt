package ru.dndshare.client.maps.rendering

import ru.dndshare.client.maps.MapEntityRef

data class MapSceneOptions(
    val animate: Boolean = true,
    val forceLod: Boolean = false,
    val automaticLod: Boolean = true,
    val focus: Set<MapEntityRef>? = null,
    val ground: Boolean = true,
    val selectedLight: String? = null,
    val selected: Set<MapEntityRef> = emptySet(),
    val streamAssets: Boolean = true,
    val preview: MapPreviewSpec = MapPreviewSpec(),
    val previewValid: Boolean = true,
)
