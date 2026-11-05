package ru.dndshare.client.ui

import androidx.compose.runtime.staticCompositionLocalOf
import kotlinx.serialization.Serializable
import ru.dndshare.client.app.AccountNavigationStore

internal val LocalAccountNavigation = staticCompositionLocalOf<AccountNavigationStore?> { null }

@Serializable
internal data class AppNavigationState(
    val page: String = AppPage.Handbook.name,
    val characters: List<String> = emptyList(),
) {
    fun normalized(allowAdmin: Boolean = false): AppNavigationState {
        val selected = AppPage.entries.firstOrNull {
            it.name == page && it != AppPage.CreateCharacter &&
                (it != AppPage.Admin || allowAdmin)
        } ?: AppPage.Handbook
        return copy(
            page = selected.name,
            characters = if (selected == AppPage.Characters) characters.filter(String::isNotBlank)
                else emptyList(),
        )
    }
}

@Serializable
internal data class HandbookNavigationState(
    val typeId: Long = 0,
    val collection: Boolean = false,
    val dictionaryId: Long = 0,
    val history: List<Long> = emptyList(),
)
