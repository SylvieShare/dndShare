package ru.dndshare.client.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

@Composable
internal fun PlaceholderScreen(page: AppPage) {
    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Column(Modifier.widthIn(max = 440.dp).verticalScroll(rememberScrollState()).padding(vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.primaryContainer) {
                CompositionLocalProvider(LocalContentColor provides WebPalette.AccentSoft) {
                    AppGlyph(page.icon, Modifier.padding(20.dp).size(40.dp))
                }
            }
            Text(page.title, style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center)
            Text(when (page) {
                AppPage.Rules -> "Правила и статьи для вашей игровой системы."
                AppPage.CreateCharacter -> "Создание персонажа для новой истории."
                AppPage.Sessions -> "Ваши игровые сессии и инструменты мастера."
                AppPage.Maps -> "Карты и места ваших приключений."
                AppPage.Admin -> "Управление DnD Share."
                AppPage.Account -> "Профиль, пароль и использование пространства."
                else -> ""
            }, style = MaterialTheme.typography.bodyLarge, textAlign = TextAlign.Center, color = WebPalette.TextSecondary)
            Text("Скоро в приложении", style = MaterialTheme.typography.labelLarge, color = WebPalette.AccentSoft)
        }
    }
}
