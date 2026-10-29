package ru.dndshare.client.ui.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.text

/** Reordering changes order only: instance parameters and concurrently added entries survive. */
internal fun orderedWeapons(current: List<JsonObject>, requested: List<String>): List<JsonObject> {
    require(requested.all(String::isNotBlank) && requested.distinct().size == requested.size)
    require(
        current.map { it.text("uid") }.distinct().size == current.size &&
            current.all { it.text("uid").isNotBlank() }
    )
    val byId = current.associateBy { it.text("uid") }
    return requested.mapNotNull(byId::get) + current.filter { it.text("uid") !in requested }
}
