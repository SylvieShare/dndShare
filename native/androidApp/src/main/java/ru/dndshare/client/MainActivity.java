package ru.dndshare.client;

import android.os.Bundle;
import android.content.res.Configuration;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/** The only UI host. Routes, forms, rules and 3D belong to the packaged frontend. */
public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) {
        registerPlugin(LocalStorePlugin.class);
        super.onCreate(state);
        if (bridge == null) return;
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowCompat.getInsetsController(getWindow(), bridge.getWebView()).setAppearanceLightStatusBars(false);
        WindowCompat.getInsetsController(getWindow(), bridge.getWebView()).setAppearanceLightNavigationBars(false);
        bridge.getWebView().setBackgroundColor(0xff17171b);
        bridge.getWebView().getSettings().setTextZoom(Math.round(getResources().getConfiguration().fontScale * 100));
        MediaCache media = new MediaCache(this);
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                // Same-origin API uses the real HTTPS server, including cookies, SSE and uploads.
                // All other application routes/assets use Capacitor's packaged local server.
                if ("dndshare.ru".equals(request.getUrl().getHost()) && request.getUrl().getPath().startsWith("/api/")) return null;
                WebResourceResponse cached = "dndshare.ru".equals(request.getUrl().getHost()) ? null : media.intercept(request);
                return cached != null ? cached : super.shouldInterceptRequest(view, request);
            }
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                ViewCompat.requestApplyInsets(view);
            }
        });
        ViewCompat.setOnApplyWindowInsetsListener(bridge.getWebView(), (view, insets) -> {
            var bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            float density = getResources().getDisplayMetrics().density;
            bridge.getWebView().evaluateJavascript("document.documentElement.style.setProperty('--native-safe-top','" + bars.top / density + "px');document.documentElement.style.setProperty('--native-safe-bottom','" + bars.bottom / density + "px')", null);
            return insets;
        });
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                bridge.getWebView().evaluateJavascript("window.dispatchEvent(new Event('dndshare:back'))", null);
            }
        });
    }
    @Override public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
        if (bridge != null) bridge.getWebView().getSettings().setTextZoom(Math.round(configuration.fontScale * 100));
    }
}
