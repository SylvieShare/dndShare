package ru.dndshare.client.network

import kotlinx.serialization.json.*
import ru.dndshare.client.character.*

/** Only the exact requested ordering proves that an earlier PUT already committed. */
internal fun journalOrderAlreadyApplied(
    journal: JsonObject,
    path: String,
    body: JsonObject,
): Boolean {
    val match =
        Regex("journals/[a-fA-F0-9-]+/sections/([0-9]+)/entries/order").matchEntire(path)
            ?: return false
    val wanted = body["entryIds"] as? JsonArray ?: return false
    val ids = wanted.map { it.referenceId() ?: return false }
    if (ids.distinct().size != ids.size) return false
    val section =
        journal["sections"]
            .arrayValue()
            .map { it.objectValue() }
            .singleOrNull { it["id"].referenceId()?.toString() == match.groupValues[1] }
            ?: return false
    return section["events"].arrayValue().map { it.referenceId() } == ids
}
