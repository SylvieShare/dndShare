package ru.dndshare.client.network

import io.ktor.client.call.body
import io.ktor.client.request.get
import ru.dndshare.client.character.*

suspend fun ApiClient.inventoryIconPresets(): List<InventoryIconPreset> =
    with(this) {
        client
            .get("$baseUrl/api/inventory/icon-presets")
            .checked()
            .body<InventoryIconsReply>()
            .presets
    }
