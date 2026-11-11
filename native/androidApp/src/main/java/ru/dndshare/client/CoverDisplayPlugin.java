package ru.dndshare.client;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.util.Log;
import android.widget.ImageView;
import androidx.annotation.OptIn;
import androidx.core.content.ContextCompat;
import androidx.core.util.Consumer;
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

/** Uses only the public dual-screen API. An OEM can report this feature unsupported. */
@OptIn(markerClass = ExperimentalWindowApi.class)
@CapacitorPlugin(name = "CoverDisplay")
public class CoverDisplayPlugin extends Plugin {
    private WindowAreaControllerCallbackAdapter controller;
    private WindowAreaInfo area;
    private WindowAreaSessionPresenter session;
    private ImageView image;
    private Bitmap bitmap;
    private String owner = "", photoUid = "";
    private PluginCall pending;
    private int generation;
    private final ExecutorService decoder = Executors.newSingleThreadExecutor();
    private final Consumer<List<WindowAreaInfo>> listener = infos -> {
        area = null;
        for (WindowAreaInfo info : infos) if (info.getType().equals(WindowAreaInfo.Type.TYPE_REAR_FACING)) { area = info; break; }
        publish();
    };
    @Override public void load() {
        getActivity().runOnUiThread(() -> {
            try {
                controller = new WindowAreaControllerCallbackAdapter(WindowAreaController.getOrCreate());
                controller.addWindowAreaInfoListListener(ContextCompat.getMainExecutor(getContext()), listener);
            } catch (Exception unavailable) { publish(); }
        });
    }
    private boolean available() {
        return session != null || area != null && area.getCapability(WindowAreaCapability.Operation.OPERATION_PRESENT_ON_AREA)
            .getStatus().equals(WindowAreaCapability.Status.WINDOW_AREA_STATUS_AVAILABLE);
    }
    private JSObject status() {
        boolean foldable = area != null || getContext().getPackageManager().hasSystemFeature("android.hardware.sensor.hinge_angle");
        boolean supported = area != null && !area.getCapability(WindowAreaCapability.Operation.OPERATION_PRESENT_ON_AREA).getStatus().equals(WindowAreaCapability.Status.WINDOW_AREA_STATUS_UNSUPPORTED);
        String reason = available() ? "" : !supported ? "Прошивка не предоставляет доступ к внешнему экрану" : "Разверните устройство и откройте приложение на внутреннем экране";
        return new JSObject().put("foldable", foldable).put("available", available()).put("active", session != null)
            .put("supported", supported).put("owner", owner).put("photoUid", session == null ? "" : photoUid).put("reason", reason);
    }
    private void publish() {
        JSObject value = status();
        notifyListeners("statusChanged", value);
        Log.i("DnDShareCover", "foldable=" + value.optBoolean("foldable") + " supported=" + value.optBoolean("supported") + " available=" + available() + " active=" + (session != null));
    }
    @PluginMethod public void getStatus(PluginCall call) { getActivity().runOnUiThread(() -> call.resolve(status())); }
    @PluginMethod public void show(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!available() || controller == null) { call.reject(status().optString("reason")); return; }
            String nextOwner = call.getString("owner", "");
            if (nextOwner.isEmpty()) { call.reject("Не указан персонаж"); return; }
            if (!nextOwner.equals(owner)) stopNow();
            if (pending != null) pending.resolve(new JSObject().put("cancelled", true));
            pending = call;
            owner = nextOwner;
            int request = ++generation;
            decoder.execute(() -> {
                try {
                    String data = call.getString("data", "");
                    if (data.length() > 12 * 1024 * 1024) throw new IllegalArgumentException("Фотография слишком большая");
                    byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                    BitmapFactory.Options bounds = new BitmapFactory.Options();
                    bounds.inJustDecodeBounds = true;
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
                    if (bounds.outWidth <= 0 || bounds.outHeight <= 0 || Math.max(bounds.outWidth, bounds.outHeight) > 4096) throw new IllegalArgumentException("Неподдерживаемая фотография");
                    Bitmap next = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                    if (next == null) throw new IllegalArgumentException("Не удалось открыть фотографию");
                    getActivity().runOnUiThread(() -> present(call, request, next, call.getString("photoUid", "")));
                } catch (Exception error) {
                    getActivity().runOnUiThread(() -> {
                        if (request != generation) return;
                        pending = null;
                        call.reject(error.getMessage());
                    });
                }
            });
        });
    }
    private void present(PluginCall call, int request, Bitmap next, String nextPhotoUid) {
        if (request != generation) return;
        bitmap = next;
        if (session != null) {
            image.setImageBitmap(next);
            photoUid = nextPhotoUid;
            pending = null;
            publish();
            call.resolve(status());
            return;
        }
        if (!available()) { pending = null; bitmap = null; owner = ""; photoUid = ""; call.reject("Режим внешнего экрана больше недоступен"); return; }
        try {
            controller.presentContentOnWindowArea(area.getToken(), getActivity(), ContextCompat.getMainExecutor(getContext()), new WindowAreaPresentationSessionCallback() {
                private WindowAreaSessionPresenter started;
                @Override public void onSessionStarted(WindowAreaSessionPresenter presenter) {
                    if (request != generation) { presenter.close(); return; }
                    started = presenter;
                    session = presenter;
                    image = new ImageView(presenter.getContext());
                    image.setBackgroundColor(android.graphics.Color.BLACK);
                    image.setScaleType(ImageView.ScaleType.FIT_CENTER);
                    image.setImageBitmap(bitmap);
                    photoUid = nextPhotoUid;
                    image.setContentDescription("Фотография персонажа");
                    presenter.setContentView(image);
                    pending = null;
                    publish();
                    call.resolve(status());
                }
                @Override public void onSessionEnded(Throwable error) {
                    if (started != null ? session != started : request != generation) return;
                    generation++;
                    session = null; image = null; bitmap = null; owner = ""; photoUid = "";
                    if (pending != null) { pending.resolve(new JSObject().put("cancelled", true)); pending = null; }
                    publish();
                }
                @Override public void onContainerVisibilityChanged(boolean visible) { }
            });
        } catch (Exception error) { pending = null; bitmap = null; owner = ""; photoUid = ""; publish(); call.reject(error.getMessage()); }
    }
    @PluginMethod public void hide(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (call.getString("owner", "").equals(owner)) stopNow();
            call.resolve(status());
        });
    }
    private void stopNow() {
        generation++;
        WindowAreaSessionPresenter previous = session;
        session = null;
        if (image != null) image.setImageDrawable(null);
        image = null; bitmap = null; owner = ""; photoUid = "";
        if (pending != null) { pending.resolve(new JSObject().put("cancelled", true)); pending = null; }
        if (previous != null) previous.close();
        publish();
    }
    public void clearForNavigation() { if (!owner.isEmpty() || pending != null || session != null) stopNow(); }
    @Override protected void handleOnStop() { getActivity().runOnUiThread(this::stopNow); }
    @Override protected void handleOnDestroy() {
        if (controller != null) controller.removeWindowAreaInfoListListener(listener);
        decoder.shutdown();
    }
}
