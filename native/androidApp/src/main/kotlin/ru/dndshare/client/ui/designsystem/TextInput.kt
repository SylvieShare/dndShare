package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.TextFieldDecorator
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
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
    val state = rememberShareInputState(value, onValueChange)
    val interactions = remember { MutableInteractionSource() }
    val border = inputBorder(interactions, enabled)
    Column(
        modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(DesignTokens.Spacing.Compact),
    ) {
        FieldCaption(label)
        BasicTextField(
            state = state,
            enabled = enabled,
            modifier =
                Modifier.fillMaxWidth()
                    .heightIn(min = DesignTokens.Layout.InputHeight)
                    .inputSurface(border)
                    .semantics { contentDescription = label },
            textStyle = fieldTextStyle.copy(color = WebPalette.Text),
            cursorBrush = SolidColor(WebPalette.Accent),
            interactionSource = interactions,
            keyboardOptions = keyboardOptions,
            lineLimits =
                if (multiline)
                    TextFieldLineLimits.MultiLine(minHeightInLines = 3, maxHeightInLines = 10)
                else TextFieldLineLimits.SingleLine,
            decorator =
                TextFieldDecorator { field ->
                    Box(
                        Modifier.padding(
                            horizontal = DesignTokens.Layout.InputPaddingHorizontal,
                            vertical = DesignTokens.Layout.InputPaddingVertical,
                        )
                    ) {
                        field()
                    }
                },
        )
    }
}

@Composable
internal fun rememberShareInputState(value: String, change: (String) -> Unit): TextFieldState {
    // Deliberately not rememberSaveable: large input is persisted by the form owner in Room.
    val state = remember { TextFieldState(initialText = value) }
    val callback by rememberUpdatedState(change)
    val registry = LocalShareFormInputs.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var sent by remember { mutableStateOf(value) }
    var observed by remember { mutableStateOf(value) }
    val acknowledgements = remember { ArrayDeque<String>() }
    LaunchedEffect(value) {
        if (value != observed) {
            observed = value
            val acknowledged = acknowledgements.indexOf(value)
            if (acknowledged >= 0) repeat(acknowledged + 1) { acknowledgements.removeFirst() }
            else {
                acknowledgements.clear()
                sent = value
                if (state.text.toString() != value) state.edit { replace(0, length, value) }
            }
        }
    }
    fun flush() {
        val current = state.text.toString()
        if (current != sent) {
            sent = current
            acknowledgements.addLast(current)
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
    return state
}
