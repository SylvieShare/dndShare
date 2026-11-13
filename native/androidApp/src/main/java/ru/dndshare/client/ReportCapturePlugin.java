package ru.dndshare.client;

import android.graphics.Bitmap;
import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.view.PixelCopy;
import android.webkit.WebView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Copy the actually rendered WebView viewport, including hardware-rendered canvases. */
@CapacitorPlugin(name = "ReportCapture")
public class ReportCapturePlugin extends Plugin {
    private final ExecutorService encoder = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private boolean capturing;

    @PluginMethod public void captureViewport(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            WebView web = getBridge().getWebView();
            if (capturing || getActivity().isFinishing() || getActivity().isDestroyed() || !web.isShown() || !web.hasWindowFocus()) {
                call.reject("The application viewport is not available"); return;
            }
            Rect area = new Rect();
            if (!web.getLocalVisibleRect(area) || area.isEmpty()) { call.reject("The application viewport is empty"); return; }
            int[] location = new int[2]; web.getLocationInWindow(location);
            area.offset(location[0], location[1]);
            double scale = Math.min(1, Math.min(1920.0 / Math.max(area.width(), area.height()),
                Math.sqrt(2_000_000.0 / ((double) area.width() * area.height()))));
            try {
                Bitmap bitmap = Bitmap.createBitmap(Math.max(1, (int) Math.round(area.width() * scale)),
                    Math.max(1, (int) Math.round(area.height() * scale)), Bitmap.Config.ARGB_8888);
                capturing = true;
                web.postOnAnimation(() -> copy(call, web, area, bitmap, 0));
            } catch (RuntimeException | OutOfMemoryError error) { call.reject("Unable to allocate the viewport image"); }
        });
    }

    private void copy(PluginCall call, WebView web, Rect area, Bitmap bitmap, int attempt) {
        try {
            if (getActivity().isDestroyed() || !web.hasWindowFocus()) throw new IllegalStateException("Window is no longer visible");
            PixelCopy.request(getActivity().getWindow(), new Rect(area), bitmap, result -> {
                if (result == PixelCopy.ERROR_SOURCE_NO_DATA && attempt == 0) {
                    web.postOnAnimation(() -> copy(call, web, area, bitmap, 1)); return;
                }
                if (result != PixelCopy.SUCCESS) { fail(call, bitmap); return; }
                try { encoder.execute(() -> encode(call, bitmap)); }
                catch (RuntimeException error) { fail(call, bitmap); }
            }, main);
        } catch (RuntimeException error) { fail(call, bitmap); }
    }

    private void fail(PluginCall call, Bitmap bitmap) {
        bitmap.recycle(); capturing = false;
        call.reject("Unable to copy the application viewport");
    }

    private void encode(PluginCall call, Bitmap bitmap) {
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            for (int quality : new int[] {82, 65, 48}) {
                output.reset();
                if (!bitmap.compress(Bitmap.CompressFormat.JPEG, quality, output)) throw new IllegalStateException("JPEG encoding failed");
                if (output.size() <= 2 * 1024 * 1024) break;
            }
            if (output.size() > 2 * 1024 * 1024) throw new IllegalStateException("Viewport image is too large");
            call.resolve(new JSObject().put("dataURL", "data:image/jpeg;base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP))
                .put("width", bitmap.getWidth()).put("height", bitmap.getHeight()));
        } catch (RuntimeException | OutOfMemoryError error) { call.reject("Unable to encode the application viewport"); }
        finally { bitmap.recycle(); main.post(() -> capturing = false); }
    }

    @Override protected void handleOnDestroy() { encoder.shutdown(); }
}
