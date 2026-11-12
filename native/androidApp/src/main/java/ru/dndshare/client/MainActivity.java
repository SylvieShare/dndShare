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
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.ServerPath;
import ru.dndshare.client.updates.FrontendUpdates;

/** The only UI host. Routes, forms, rules and 3D belong to the packaged frontend. */
public class MainActivity extends BridgeActivity {
    private FrontendUpdates frontendUpdates;
    public FrontendUpdates getFrontendUpdates() { return frontendUpdates; }
    @Override protected void load() {
        try {
            frontendUpdates = new FrontendUpdates(this);
            String directory = frontendUpdates.startup();
            if (directory != null) bridgeBuilder.setServerPath(new ServerPath(ServerPath.PathType.BASE_PATH,directory));
        } catch(Exception error) { throw new IllegalStateException("Cannot initialize frontend releases",error); }
        super.load();
        frontendUpdates.attach(this::loadFrontendDirectory);
    }
    public void loadFrontendDirectory(String directory) {
        String current = bridge.getWebView().getUrl();
        if (directory == null) bridge.setServerAssetPath("public");
        else bridge.setServerBasePath(directory);
        if (current != null && !current.equals("https://dndshare.ru/") && !current.equals("https://dndshare.ru")) bridge.getWebView().post(() -> bridge.getWebView().loadUrl(current));
    }
    @Override public void onCreate(Bundle state) {
        registerPlugin(LocalStorePlugin.class);
        registerPlugin(CoverDisplayPlugin.class);
        registerPlugin(FrontendUpdaterPlugin.class);
        super.onCreate(state);
        if (bridge == null) return;
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowCompat.getInsetsController(getWindow(), bridge.getWebView()).setAppearanceLightStatusBars(false);
        WindowCompat.getInsetsController(getWindow(), bridge.getWebView()).setAppearanceLightNavigationBars(false);
        if (android.os.Build.VERSION.SDK_INT >= 28) {
            var attributes = getWindow().getAttributes();
            attributes.layoutInDisplayCutoutMode = android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(attributes);
        }
        hideSystemBars();
        bridge.getWebView().setBackgroundColor(0xff17171b);
        bridge.getWebView().getSettings().setTextZoom(Math.round(getResources().getConfiguration().fontScale * 100));
        MediaCache media = new MediaCache(this);
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                // Same-origin API uses the real HTTPS server, including cookies, SSE and uploads.
                // All other application routes/assets use Capacitor's packaged local server.
                if (isApiDataRequest(request)) return null;
                WebResourceResponse cached = "dndshare.ru".equals(request.getUrl().getHost()) ? null : media.intercept(request);
                return cached != null ? cached : super.shouldInterceptRequest(view, request);
            }
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                ViewCompat.requestApplyInsets(getWindow().getDecorView());
            }
        });
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (view, insets) -> {
            // Transient system bars overlay the UI; revealing them must not resize the page.
            var bars = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
            var keyboard = insets.getInsets(WindowInsetsCompat.Type.ime());
            view.setPadding(bars.left, 0, bars.right, keyboard.bottom);
            float density = getResources().getDisplayMetrics().density;
            bridge.getWebView().evaluateJavascript("document.documentElement.style.setProperty('--native-safe-top','" + bars.top / density + "px');document.documentElement.style.setProperty('--native-safe-bottom','" + bars.bottom / density + "px')", null);
            return new WindowInsetsCompat.Builder(insets)
                .setInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime(), androidx.core.graphics.Insets.NONE)
                .build();
        });
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                bridge.getWebView().evaluateJavascript("window.dispatchEvent(new Event('dndshare:back',{cancelable:true}))", null);
            }
        });
    }
    private void hideSystemBars() {
        var controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.navigationBars());
        ViewCompat.requestApplyInsets(getWindow().getDecorView());
    }
    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }
    private boolean isApiDataRequest(WebResourceRequest request) {
        if (!"dndshare.ru".equals(request.getUrl().getHost()) || !request.getUrl().getPath().startsWith("/api/") || request.isForMainFrame()) return false;
        for (var header : request.getRequestHeaders().entrySet()) {
            if (header.getKey().equalsIgnoreCase("Accept") && header.getValue().contains("text/html")) return false;
            if (header.getKey().equalsIgnoreCase("Sec-Fetch-Dest") && java.util.Arrays.asList("document", "iframe", "frame", "object", "embed", "script", "worker", "sharedworker", "serviceworker").contains(header.getValue())) return false;
        }
        return true;
    }
    @Override public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
        if (bridge != null) bridge.getWebView().getSettings().setTextZoom(Math.round(configuration.fontScale * 100));
    }
    @Override public void onStart() { super.onStart(); if(frontendUpdates!=null) frontendUpdates.foreground(); }
    @Override public void onStop() { if(frontendUpdates!=null) frontendUpdates.background(isChangingConfigurations()); super.onStop(); }
    @Override public void onDestroy() { if(frontendUpdates!=null) frontendUpdates.close(); super.onDestroy(); }
}
