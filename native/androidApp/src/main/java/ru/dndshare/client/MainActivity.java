package ru.dndshare.client;

import android.os.Bundle;
import android.content.res.Configuration;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.ViewCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.ServerPath;
import ru.dndshare.client.updates.FrontendUpdates;

/** The only UI host. Routes, forms, rules and 3D belong to the packaged frontend. */
public class MainActivity extends BridgeActivity {
    private FrontendUpdates frontendUpdates;
    private SystemChrome systemChrome;
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
        systemChrome = new SystemChrome(this, bridge.getWebView());
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
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                bridge.getWebView().evaluateJavascript("window.dispatchEvent(new Event('dndshare:back',{cancelable:true}))", null);
            }
        });
    }
    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && systemChrome != null) systemChrome.apply();
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
        if (systemChrome != null) systemChrome.apply();
    }
    @Override public void onStart() { super.onStart(); if(frontendUpdates!=null) frontendUpdates.foreground(); }
    @Override public void onStop() { if(frontendUpdates!=null) frontendUpdates.background(isChangingConfigurations()); super.onStop(); }
    @Override public void onDestroy() { if(frontendUpdates!=null) frontendUpdates.close(); super.onDestroy(); }
}
