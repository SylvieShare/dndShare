package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

fun contentSourceEligible(item: CatalogueItem, settings: JsonObject): Boolean {
    if (settings.text("mode") != "selected" || item.userId != null || item.contentSources.isEmpty())
        return true
    val chosen = settings["ids"].arrayValue().mapNotNull { it.referenceId() }.toSet()
    return item.contentSources.any { it.id in chosen }
}
