package ru.dndshare.client.maps

/**
 * Loading a server snapshot must not roll back UI commands issued while that request was pending.
 */
fun mergeOpenedMapWork(remote: MapWork, local: MapWork?): MapWork {
    if (local == null) return remote
    val chosen = if (local.dirty && local.localVersion >= remote.localVersion) local else remote
    return if (local.localVersion >= remote.localVersion - 1 && local.ui != chosen.ui)
        chosen.copy(
            ui = local.ui,
            localVersion = maxOf(local.localVersion, remote.localVersion) + 1,
        )
    else chosen
}
