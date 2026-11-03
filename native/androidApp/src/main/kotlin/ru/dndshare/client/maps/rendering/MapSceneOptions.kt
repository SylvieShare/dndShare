package ru.dndshare.client.maps.rendering

import ru.dndshare.client.maps.MapEntityRef

data class MapSceneOptions(
    val animate: Boolean = true,
    val forceLod: Boolean = false,
    val focus: Set<MapEntityRef>? = null,
    val ground: Boolean = true,
)
