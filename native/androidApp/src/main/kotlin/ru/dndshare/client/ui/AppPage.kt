package ru.dndshare.client.ui

import ru.dndshare.client.model.User

enum class AppPage(val title: String, val icon: Glyph, val group: String = "") {
    Handbook("Справочник", Glyph.Book),
    Rules("Правила игрока", Glyph.Rules, "Для игрока"),
    Characters("Персонажи", Glyph.Characters, "Для игрока"),
    CreateCharacter("Создать персонажа", Glyph.CreateCharacter, "Для игрока"),
    Sessions("Сессии", Glyph.Sessions, "Для мастера"),
    Maps("Карты", Glyph.Maps, "Для мастера"),
    Admin("Админка", Glyph.Admin, "Служебное"),
    Account("Аккаунт", Glyph.Account),
}

// Match frontend/src/shared/lib/appNavigation.js, including account and role visibility.
fun appDestinations(user: User): List<AppPage> = buildList {
    add(AppPage.Handbook)
    add(AppPage.Rules)
    add(if (user.hasCharacters) AppPage.Characters else AppPage.CreateCharacter)
    add(AppPage.Sessions)
    add(AppPage.Maps)
    if ("ADMIN" in user.roles) add(AppPage.Admin)
}
