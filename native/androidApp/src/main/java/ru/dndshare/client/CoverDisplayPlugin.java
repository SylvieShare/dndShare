package ru.dndshare.client;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.util.Log;
import android.widget.ImageView;
import androidx.annotation.OptIn;
import androidx.core.content.ContextCompat;
import androidx.core.util.Consumer;
import androidx.lifecycle.Lifecycle;
import androidx.window.area.WindowAreaCapability;
import androidx.window.area.WindowAreaController;
import androidx.window.area.WindowAreaInfo;
import androidx.window.area.WindowAreaPresentationSessionCallback;
import androidx.window.area.WindowAreaSessionPresenter;
import androidx.window.core.ExperimentalWindowApi;
import androidx.window.java.area.WindowAreaControllerCallbackAdapter;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

/** App-session selection is independent of routes and Activity visibility. */
@OptIn(markerClass = ExperimentalWindowApi.class)
@CapacitorPlugin(name = "CoverDisplay")
public class CoverDisplayPlugin extends Plugin {
    private static final class Photo {
        final String owner, uid;
        final Bitmap bitmap;
        boolean resumeAllowed = true;
        Photo(String owner, String uid, Bitmap bitmap) { this.owner = owner; this.uid = uid; this.bitmap = bitmap; }
    }
    // Memory only: configuration changes retain selection; finishing the task clears it.
    private static Photo selected;
    private WindowAreaControllerCallbackAdapter controller;
    private WindowAreaInfo area;
    private WindowAreaSessionPresenter session;
    private ImageView image;
    private PluginCall pending;
    private String pendingOwner = "";
    private int photoGeneration, sessionGeneration;
    private boolean resumed, starting, presentationVisible, resumeAfterBackground;
    private final ExecutorService decoder = Executors.newSingleThreadExecutor();
    private final Consumer<List<WindowAreaInfo>> listener = infos -> {
        area = null;
        for (WindowAreaInfo info : infos) if (info.getType().equals(WindowAreaInfo.Type.TYPE_REAR_FACING)) { area = info; break; }
        publish();
        maybeResume();
    };
    @Override public void load() {
        getActivity().runOnUiThread(() -> {
            resumed = getActivity().getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED);
            resumeAfterBackground = selected != null;
            try {
                controller = new WindowAreaControllerCallbackAdapter(WindowAreaController.getOrCreate());
                controller.addWindowAreaInfoListListener(ContextCompat.getMainExecutor(getContext()), listener);
            } catch (Exception unavailable) { publish(); }
        });
    }
    private boolean supported() {
        return area != null && !area.getCapability(WindowAreaCapability.Operation.OPERATION_PRESENT_ON_AREA).getStatus().equals(WindowAreaCapability.Status.WINDOW_AREA_STATUS_UNSUPPORTED);
    }
    private boolean available() {
        return session != null || area != null && area.getCapability(WindowAreaCapability.Operation.OPERATION_PRESENT_ON_AREA).getStatus().equals(WindowAreaCapability.Status.WINDOW_AREA_STATUS_AVAILABLE);
    }
    private JSObject status() {
        boolean foldable = area != null || getContext().getPackageManager().hasSystemFeature("android.hardware.sensor.hinge_angle");
        String reason = available() ? "" : !supported() ? "Прошивка не предоставляет доступ к внешнему экрану" : "Разверните устройство и откройте приложение на внутреннем экране";
        return new JSObject().put("foldable", foldable).put("supported", supported()).put("available", available())
            .put("active", session != null && presentationVisible).put("selected", selected != null)
            .put("owner", selected == null ? "" : selected.owner).put("photoUid", selected == null ? "" : selected.uid).put("reason", reason);
    }
    private void publish() {
        JSObject value = status();
        notifyListeners("statusChanged", value);
        Log.i("DnDShareCover", "foldable=" + value.optBoolean("foldable") + " supported=" + supported() + " available=" + available() + " active=" + value.optBoolean("active") + " selected=" + (selected != null));
    }
    @PluginMethod public void getStatus(PluginCall call) { getActivity().runOnUiThread(() -> call.resolve(status())); }
    @PluginMethod public void show(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!supported() || controller == null) { call.reject(status().optString("reason")); return; }
            String owner = call.getString("owner", "");
            if (owner.isEmpty()) { call.reject("Не указан персонаж"); return; }
            completePending(new JSObject().put("cancelled", true));
            pending = call;
            pendingOwner = owner;
            int request = ++photoGeneration;
            decoder.execute(() -> {
                try {
                    String data = call.getString("data", "");
                    if (data.length() > 12 * 1024 * 1024) throw new IllegalArgumentException("Фотография слишком большая");
                    byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                    BitmapFactory.Options bounds = new BitmapFactory.Options();
                    bounds.inJustDecodeBounds = true;
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
                    if (bounds.outWidth <= 0 || bounds.outHeight <= 0 || Math.max(bounds.outWidth, bounds.outHeight) > 4096) throw new IllegalArgumentException("Неподдерживаемая фотография");
                    Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                    if (bitmap == null) throw new IllegalArgumentException("Не удалось открыть фотографию");
                    getActivity().runOnUiThread(() -> {
                        if (request != photoGeneration) return;
                        rememberPhoto(owner, call.getString("photoUid", ""), bitmap);
                        if (session != null) {
                            image.setImageBitmap(bitmap);
                            publish();
                            completePending(status());
                        } else if (resumed && available() && !starting) beginPresentation();
                        else { resumeAfterBackground = true; publish(); completePending(status()); }
                    });
                } catch (Exception error) {
                    getActivity().runOnUiThread(() -> {
                        if (request != photoGeneration) return;
                        pending = null; pendingOwner = "";
                        call.reject(error.getMessage());
                    });
                }
            });
        });
    }
    void rememberPhoto(String owner, String uid, Bitmap bitmap) { selected = new Photo(owner, uid, bitmap); }
    private void completePending(JSObject result) {
        PluginCall call = pending;
        pending = null; pendingOwner = "";
        if (call != null) call.resolve(result);
    }
    private void beginPresentation() {
        if (starting || session != null || selected == null || !resumed || !available()) return;
        starting = true;
        resumeAfterBackground = false;
        int request = ++sessionGeneration;
        try {
            controller.presentContentOnWindowArea(area.getToken(), getActivity(), ContextCompat.getMainExecutor(getContext()), new WindowAreaPresentationSessionCallback() {
                private boolean started;
                @Override public void onSessionStarted(WindowAreaSessionPresenter presenter) {
                    if (request != sessionGeneration || selected == null) { presenter.close(); return; }
                    started = true; starting = false;
                    session = presenter; presentationVisible = true;
                    image = new ImageView(presenter.getContext());
                    image.setBackgroundColor(android.graphics.Color.BLACK);
                    image.setScaleType(ImageView.ScaleType.FIT_CENTER);
                    image.setKeepScreenOn(true);
                    image.setImageBitmap(selected.bitmap);
                    image.setContentDescription("Фотография персонажа");
                    presenter.setContentView(image);
                    publish();
                    completePending(status());
                }
                @Override public void onSessionEnded(Throwable error) {
                    if (request != sessionGeneration) return;
                    session = null; starting = false; presentationVisible = false;
                    if (image != null) image.setImageDrawable(null);
                    image = null;
                    if (!started) {
                        if (selected != null) selected.resumeAllowed = false;
                        resumeAfterBackground = false;
                        completePending(new JSObject().put("cancelled", true));
                    } else if (!resumed) resumeAfterBackground = true;
                    publish();
                    maybeResume();
                }
                @Override public void onContainerVisibilityChanged(boolean visible) {
                    if (request != sessionGeneration) return;
                    presentationVisible = visible;
                    if (visible) resumeAfterBackground = false;
                    publish();
                }
            });
        } catch (Exception error) {
            starting = false;
            PluginCall call = pending;
            pending = null; pendingOwner = "";
            publish();
            if (call != null) call.reject(error.getMessage());
        }
    }
    private void maybeResume() {
        if (!resumed || !resumeAfterBackground || selected == null || !selected.resumeAllowed || starting || pending != null) return;
        if (session != null) { if (presentationVisible) resumeAfterBackground = false; return; }
        if (available()) beginPresentation();
    }
    @PluginMethod public void hide(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            String owner = call.getString("owner", "");
            if (!owner.isEmpty() && (selected != null && owner.equals(selected.owner) || owner.equals(pendingOwner))) closePresentation(true);
            call.resolve(status());
        });
    }
    private void closePresentation(boolean clearSelection) {
        photoGeneration++; sessionGeneration++;
        WindowAreaSessionPresenter previous = session;
        session = null; starting = false; presentationVisible = false; resumeAfterBackground = false;
        if (image != null) image.setImageDrawable(null);
        image = null;
        if (clearSelection) selected = null;
        completePending(new JSObject().put("cancelled", true));
        if (previous != null) previous.close();
        publish();
    }
    @Override protected void handleOnResume() { resumed = true; maybeResume(); }
    @Override protected void handleOnPause() { resumed = false; }
    @Override protected void handleOnStop() { if (selected != null || pending != null) resumeAfterBackground = true; }
    @Override protected void handleOnDestroy() {
        getActivity().runOnUiThread(() -> {
            closePresentation(getActivity().isFinishing());
            if (controller != null) controller.removeWindowAreaInfoListListener(listener);
        });
        decoder.shutdown();
    }
}
