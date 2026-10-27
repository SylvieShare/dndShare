package ru.dndshare.client.app

import ru.dndshare.client.data.CatalogueRepository
import ru.dndshare.client.model.*

data class AppState(
    val booting: Boolean = true,
    val signingIn: Boolean = false,
    val user: User? = null,
    val sources: List<GameSource> = emptyList(),
    val sourceId: Long = 0,
    val editionId: Long = 0,
    val repository: CatalogueRepository? = null,
    val synchronizing: Boolean = false,
    val received: Int = 0,
    val offline: Boolean = false,
    val error: String? = null,
    val characterError: String? = null,
    val authError: String? = null,
    val confirmLogout: Boolean = false,
)
