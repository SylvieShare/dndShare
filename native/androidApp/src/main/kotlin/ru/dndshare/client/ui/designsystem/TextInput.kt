package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import kotlinx.coroutines.flow.distinctUntilChanged

/**
 * Flush local editing buffers before accepting a form, without routing keystrokes through a screen
 * flow.
 */
class ShareFormInputs {
    private val fields = linkedMapOf<Any, () -> Unit>()

    fun register(key: Any, flush: () -> Unit) {
        fields[key] = flush
    }

    fun unregister(key: Any) {
        fields.remove(key)
    }

    fun flush() {
        fields.values.toList().forEach { it() }
    }
}

val LocalShareFormInputs = staticCompositionLocalOf<ShareFormInputs?> { null }

@Composable
fun ShareTextInput(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    multiline: Boolean = false,
    keyboardOptions: KeyboardOptions = KeyboardOptions(autoCorrectEnabled = false),
) {
    // Deliberately not rememberSaveable: large input is persisted by the form owner in Room.
    val state = remember { TextFieldState(initialText = value) }
    val callback by rememberUpdatedState(onValueChange)
    val registry = LocalShareFormInputs.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var sent by remember { mutableStateOf(value) }
    fun flush() {
        val current = state.text.toString()
        if (current != sent) {
            sent = current
            callback(current)
        }
    }
    LaunchedEffect(state) {
        snapshotFlow { state.text.toString() }.distinctUntilChanged().collect { flush() }
    }
    DisposableEffect(state, registry, lifecycle) {
        val key = Any()
        registry?.register(key, ::flush)
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP) flush()
        }
        lifecycle.addObserver(observer)
        onDispose {
            registry?.unregister(key)
            lifecycle.removeObserver(observer)
        }
    }
    OutlinedTextField(
        state = state,
        label = { Text(label) },
        enabled = enabled,
        modifier = modifier.fillMaxWidth().semantics { contentDescription = label },
        keyboardOptions = keyboardOptions,
        lineLimits =
            if (multiline)
                TextFieldLineLimits.MultiLine(minHeightInLines = 3, maxHeightInLines = 10)
            else TextFieldLineLimits.SingleLine,
    )
}
