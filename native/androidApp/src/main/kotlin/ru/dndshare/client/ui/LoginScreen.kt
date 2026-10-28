package ru.dndshare.client.ui

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.input.*
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.lerp
import ru.dndshare.client.app.AppState
import ru.dndshare.client.ui.designsystem.*

@Composable
fun LoginScreen(state: AppState, login: (String, String) -> Unit, create: (() -> Unit)? = null) {
    var name by rememberSaveable { mutableStateOf("") }
    // Passwords deliberately stay out of saved instance state and preferences.
    var password by remember { mutableStateOf("") }
    val focus = LocalFocusManager.current
    val keyboard = LocalSoftwareKeyboardController.current
    val submit = {
        if (name.isNotBlank() && password.isNotBlank() && !state.signingIn) {
            focus.clearFocus()
            keyboard?.hide()
            login(name, password)
        }
    }
    BoxWithConstraints(
        Modifier.fillMaxSize()
            .windowInsetsPadding(WindowInsets.systemBars.union(WindowInsets.displayCutout))
            .imePadding()
            .padding(horizontal = 24.dp),
        contentAlignment = Alignment.TopCenter,
    ) {
        val compact = maxHeight < 600.dp * LocalDensity.current.fontScale.coerceAtLeast(1f)
        val collapse by
            animateFloatAsState(
                if (compact) 1f else 0f,
                tween(240, easing = FastOutSlowInEasing),
                label = "Login header",
            )
        Column(
            Modifier.widthIn(max = 420.dp)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .heightIn(min = maxHeight)
                .padding(vertical = lerp(40.dp, 16.dp, collapse)),
            verticalArrangement =
                Arrangement.spacedBy(lerp(18.dp, 12.dp, collapse), Alignment.CenterVertically),
        ) {
            LoginBrand(collapse)
            ShareValueInput(
                value = name,
                onValueChange = { name = it.take(128) },
                modifier = Modifier.fillMaxWidth(),
                label = "Логин",
                enabled = !state.signingIn,
                keyboardOptions =
                    KeyboardOptions(autoCorrectEnabled = false, imeAction = ImeAction.Next),
                keyboardActions =
                    KeyboardActions(onNext = { focus.moveFocus(FocusDirection.Down) }),
            )
            ShareValueInput(
                value = password,
                onValueChange = { password = it.take(256) },
                modifier = Modifier.fillMaxWidth(),
                label = "Пароль",
                enabled = !state.signingIn,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions =
                    KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done,
                    ),
                keyboardActions = KeyboardActions(onDone = { submit() }),
            )
            if (state.authError != null)
                Text(state.authError, color = MaterialTheme.colorScheme.error)
            ShareButton(
                onClick = submit,
                colors =
                    ButtonDefaults.buttonColors(
                        containerColor = WebPalette.Accent,
                        contentColor = WebPalette.OnAccent,
                    ),
                shape = MaterialTheme.shapes.medium,
                enabled = name.isNotBlank() && password.isNotEmpty() && !state.signingIn,
                modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
            ) {
                if (state.signingIn) {
                    CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(10.dp))
                }
                Text(if (state.signingIn) "Входим…" else "Войти")
            }
            Text(
                "Используйте свой аккаунт DnD Share.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            create?.let {
                ShareTextButton(onClick = it, modifier = Modifier.fillMaxWidth()) {
                    Text("Сначала создать персонажа")
                }
            }
        }
    }
}
