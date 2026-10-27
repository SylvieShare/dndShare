package ru.dndshare.client.ui

import ru.dndshare.client.ui.designsystem.*

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import ru.dndshare.client.app.AppController
import ru.dndshare.client.app.AppState

internal val LocalAppDrawerOpen = compositionLocalOf { false }

@Composable
internal fun AppNavigationShell(
    format: LayoutFormat, page: AppPage, state: AppState, controller: AppController,
    navigate: (AppPage) -> Unit, content: @Composable (openMenu: () -> Unit) -> Unit,
) {
    var wideExpanded by rememberSaveable { mutableStateOf(true) }
    val drawer = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val isWide = format == LayoutFormat.Wide
    val overlayOpen = !isWide && (drawer.currentValue != DrawerValue.Closed || drawer.targetValue != DrawerValue.Closed)
    LaunchedEffect(isWide) { if (isWide) drawer.close() }
    val panelWidth by animateDpAsState(when (format) {
        LayoutFormat.Phone -> 0.dp
        LayoutFormat.Tablet -> 0.dp
        LayoutFormat.Wide -> if (wideExpanded) DesignTokens.Layout.SidebarExpanded else DesignTokens.Layout.SidebarCollapsed
    }, tween(DesignTokens.Motion.Navigation), label = "Sidebar width")
    val openMenu: () -> Unit = {
        if (isWide) wideExpanded = !wideExpanded else scope.launch { drawer.open() }
    }
    val select: (AppPage) -> Unit = { destination ->
        navigate(destination)
        scope.launch { drawer.close() }
    }
    ModalNavigationDrawer(
        drawerState = drawer, gesturesEnabled = !isWide,
        scrimColor = WebPalette.Scrim,
        drawerContent = {
            if (!isWide) ModalDrawerSheet(
                modifier = Modifier.widthIn(max = DesignTokens.Layout.Drawer).fillMaxHeight(),
                drawerShape = MaterialTheme.shapes.extraSmall,
                drawerContainerColor = WebPalette.Surface,
                windowInsets = WindowInsets(0, 0, 0, 0),
            ) {
                AppSidebar(true, page, state, controller, "Закрыть меню", Glyph.Close,
                    { scope.launch { drawer.close() } }, select)
            }
        },
    ) {
        Row(Modifier.fillMaxSize()) {
            if (isWide) Surface(
                modifier = Modifier.width(panelWidth).fillMaxHeight(), shadowElevation = 6.dp,
                border = BorderStroke(1.dp, WebPalette.BorderStrong), color = WebPalette.Surface,
            ) {
                AppSidebar(isWide && wideExpanded, page, state, controller,
                    if (isWide && wideExpanded) "Свернуть панель" else "Раскрыть панель",
                    Glyph.Collapse, openMenu, select)
            }
            Box(Modifier.weight(1f).fillMaxHeight()) {
                CompositionLocalProvider(LocalAppDrawerOpen provides overlayOpen) { content(openMenu) }
            }
        }
    }
    // Include the opening animation; Scaffold can subcompose screen handlers after this one.
    BackHandler(overlayOpen) { scope.launch { drawer.close() } }
}
