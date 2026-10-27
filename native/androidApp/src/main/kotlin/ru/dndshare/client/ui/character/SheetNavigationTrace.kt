package ru.dndshare.client.ui.character

import android.util.Log
import ru.dndshare.client.BuildConfig

/** Opt-in diagnostics contain section names only; no account or character payload. */
internal fun traceSheetNavigation(message: () -> String) {
    if (BuildConfig.DEBUG && Log.isLoggable("DndSheetNav", Log.DEBUG)) Log.d("DndSheetNav", message())
}
