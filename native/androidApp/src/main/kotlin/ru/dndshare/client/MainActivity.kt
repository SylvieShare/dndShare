package ru.dndshare.client

import android.app.Application
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.SystemBarStyle
import android.graphics.Color
import androidx.activity.viewModels
import androidx.compose.runtime.*
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.window.layout.FoldingFeature
import androidx.window.layout.WindowInfoTracker
import ru.dndshare.client.app.AppController
import ru.dndshare.client.network.ApiClient
import ru.dndshare.client.device.AndroidDeviceServices
import ru.dndshare.client.ui.DndShareApp
import ru.dndshare.client.ui.FoldInfo

class ClientViewModel(application: Application) : AndroidViewModel(application) {
    private val platform = AndroidDeviceServices(application, BuildConfig.API_BASE_URL)
    val controller = AppController(platform, ApiClient(BuildConfig.API_BASE_URL, platform))
    override fun onCleared() { controller.close() }
}

class MainActivity : ComponentActivity() {
    private val model: ClientViewModel by viewModels()
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT))
        setContent {
            var fold by remember { mutableStateOf<FoldInfo?>(null) }
            LaunchedEffect(this@MainActivity) {
                WindowInfoTracker.getOrCreate(this@MainActivity).windowLayoutInfo(this@MainActivity).collect { info ->
                    fold = info.displayFeatures.filterIsInstance<FoldingFeature>().firstOrNull()?.let {
                        FoldInfo(it.bounds.left, it.bounds.top, it.bounds.right, it.bounds.bottom,
                            it.orientation == FoldingFeature.Orientation.VERTICAL, it.isSeparating)
                    }
                }
            }
            DisposableEffect(lifecycle) {
                val observer = LifecycleEventObserver { _, event ->
                    if (event == Lifecycle.Event.ON_START) model.controller.foreground(true)
                    if (event == Lifecycle.Event.ON_STOP) model.controller.foreground(false)
                }
                lifecycle.addObserver(observer)
                model.controller.foreground(lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED))
                onDispose { lifecycle.removeObserver(observer) }
            }
            DndShareApp(model.controller, fold)
        }
    }
}
