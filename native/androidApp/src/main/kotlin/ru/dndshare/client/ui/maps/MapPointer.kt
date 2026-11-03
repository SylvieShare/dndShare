package ru.dndshare.client.ui.maps

import ru.dndshare.client.maps.MapEntityRef
import ru.dndshare.client.maps.MapPose

internal data class MapPointer(
    val hit: MapEntityRef?,
    val world: MapPose,
    val x: Float,
    val y: Float,
)
