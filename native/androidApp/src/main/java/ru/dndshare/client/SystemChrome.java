package ru.dndshare.client;

import android.app.Activity;
import android.os.Build;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

/** One owner for system bars, camera safe areas and the software keyboard. */
final class SystemChrome {
    private final Activity activity;
    private final WebView webView;

    SystemChrome(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        var window = activity.getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        if (Build.VERSION.SDK_INT >= 28) {
            var attributes = window.getAttributes();
            attributes.layoutInDisplayCutoutMode = android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(attributes);
        }
        if (Build.VERSION.SDK_INT >= 29) window.setStatusBarContrastEnforced(false);
        ViewCompat.setOnApplyWindowInsetsListener(window.getDecorView(), (view, insets) -> {
            var cutout = insets.getInsets(WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.captionBar());
            var keyboard = insets.getInsets(WindowInsetsCompat.Type.ime());
            int top = Math.max(cutout.top, phone() ? insets.getInsetsIgnoringVisibility(WindowInsetsCompat.Type.statusBars()).top : 0);
            view.setPadding(cutout.left, 0, cutout.right, keyboard.bottom);
            float density = activity.getResources().getDisplayMetrics().density;
            webView.evaluateJavascript("document.documentElement.style.setProperty('--native-safe-top','" + top / density + "px');document.documentElement.style.setProperty('--native-safe-bottom','" + cutout.bottom / density + "px')", null);
            return new WindowInsetsCompat.Builder(insets)
                .setInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime(), Insets.NONE)
                .build();
        });
        apply();
    }

    private boolean phone() {
        return activity.getResources().getConfiguration().screenWidthDp < activity.getResources().getInteger(R.integer.tablet_min_width_dp);
    }

    void apply() {
        var window = activity.getWindow();
        var controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.navigationBars());
        if (phone()) controller.show(WindowInsetsCompat.Type.statusBars());
        else controller.hide(WindowInsetsCompat.Type.statusBars());
        ViewCompat.requestApplyInsets(window.getDecorView());
    }
}
