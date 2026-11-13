package ru.dndshare.client;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.util.Log;
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
    private static final CoverSlideshow.State slideshowState = new CoverSlideshow.State();
    private WindowAreaControllerCallbackAdapter controller;
    private WindowAreaInfo area;
    private WindowAreaSessionPresenter session;
    private CoverPhotoView image;
    private CoverSlideshow slideshow;
    private PluginCall pending;
    private String pendingOwner = "";
    private String pendingPhotoUid = "";
    private int photoGeneration, sessionGeneration;
    private boolean resumed, starting, presentationVisible, resumeAfterBackground;
    private final ExecutorService decoder = Executors.newSingleThreadExecutor();
    private final Consumer<List<WindowAreaInfo>> listener = infos -> {
        area = null;
        for (WindowAreaInfo info : infos) if (info.getType().equals(WindowAreaInfo.Type.TYPE_REAR_FACING)) { area = info; break; }
        if (area != null && session == null && slideshow != null) {
            android.graphics.Rect bounds = area.getMetrics().getBounds();
            slideshow.setViewport(bounds.width(), bounds.height());
        }
        publish();
        maybeResume();
    };
    @Override public void load() {
        getActivity().runOnUiThread(() -> {
            resumed = getActivity().getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED);
            resumeAfterBackground = selected != null;
            slideshow = new CoverSlideshow(slideshowState, new CoverPhotoStore(getContext()), new CoverSlideshow.Listener() {
                @Override public void changed() { publish(); }
                @Override public void ready(String owner, CoverPhotoSource photo, Bitmap bitmap) {
                    photoGeneration++;
                    rememberPhoto(owner, photo.uid, bitmap);
                    if (session != null && image != null) { image.show(bitmap, true); completePending(status()); }
                    else if (resumed && available() && !starting) beginPresentation();
                    else { resumeAfterBackground = true; completePending(status()); }
                }
                @Override public void failed(String message) {
                    PluginCall call = pending; pending = null; pendingOwner = "";
                    if (call != null) call.reject(message);
                }
            });
            try {
                controller = new WindowAreaControllerCallbackAdapter(WindowAreaController.getOrCreate());
                controller.addWindowAreaInfoListListener(ContextCompat.getMainExecutor(getContext()), listener);
            } catch (Exception unavailable) { publish(); }
            if (slideshowState.enabled) slideshow.configure(slideshowState.owner, new java.util.ArrayList<>(slideshowState.photos), true);
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
            .put("autoplay", slideshowState.enabled).put("autoOwner", slideshowState.owner).put("autoPhotoCount", slideshowState.photos.size())
            .put("loading", slideshow != null && slideshow.loading).put("error", slideshow == null ? "" : slideshow.error)
            .put("displayWidth", slideshow == null ? 0 : slideshow.width()).put("displayHeight", slideshow == null ? 0 : slideshow.height())
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
            slideshow.stop();
            completePending(new JSObject().put("cancelled", true));
            pending = call;
            pendingOwner = owner;
            pendingPhotoUid = call.getString("photoUid", "");
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
                            image.show(bitmap, true);
                            publish();
                            completePending(status());
                        } else if (resumed && available() && !starting) beginPresentation();
                        else { resumeAfterBackground = true; publish(); completePending(status()); }
                    });
                } catch (Exception error) {
                    getActivity().runOnUiThread(() -> {
                        if (request != photoGeneration) return;
                        pending = null; pendingOwner = ""; pendingPhotoUid = "";
                        call.reject(error.getMessage());
                    });
                }
            });
        });
    }
    void rememberPhoto(String owner, String uid, Bitmap bitmap) { selected = new Photo(owner, uid, bitmap); }
    void clearForLogout() { closePresentation(true); }
    @PluginMethod public void startSlideshow(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!supported() || !available()) { call.reject(status().optString("reason")); return; }
            String owner = call.getString("owner", "");
            List<CoverPhotoSource> photos = CoverPhotoSource.read(call.getArray("photos"));
            if (owner.isEmpty() || photos.isEmpty()) { call.reject("Добавьте фотографии в галерею"); return; }
            photoGeneration++;
            completePending(new JSObject().put("cancelled", true));
            pending = call; pendingOwner = owner;
            pendingPhotoUid = "";
            slideshow.configure(owner, photos, false);
        });
    }
    @PluginMethod public void pauseSlideshow(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            String owner = call.getString("owner", "");
            if (owner.equals(slideshowState.owner)) {
                photoGeneration++; slideshow.pause(owner); completePending(status());
            }
            call.resolve(status());
        });
    }
    @PluginMethod public void updateSlideshow(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            String owner = call.getString("owner", "");
            if (slideshowState.enabled && owner.equals(slideshowState.owner)) {
                List<CoverPhotoSource> photos = CoverPhotoSource.read(call.getArray("photos"));
                if (photos.isEmpty()) closePresentation(true);
                else slideshow.configure(owner, photos, true);
            }
            call.resolve(status());
        });
    }
    @PluginMethod public void cancelPhoto(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            String owner = call.getString("owner", ""), uid = call.getString("photoUid", "");
            if (!owner.isEmpty() && !uid.isEmpty()) {
                if (owner.equals(pendingOwner) && uid.equals(pendingPhotoUid)) {
                    photoGeneration++; completePending(new JSObject().put("cancelled", true));
                }
                if (!slideshowState.enabled && selected != null && owner.equals(selected.owner) && uid.equals(selected.uid)) closePresentation(true);
            }
            call.resolve(status());
        });
    }
    private void completePending(JSObject result) {
        PluginCall call = pending;
        pending = null; pendingOwner = ""; pendingPhotoUid = "";
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
                    image = new CoverPhotoView(presenter.getContext(), (width, height) -> slideshow.setViewport(width, height));
                    image.show(selected.bitmap, false);
                    presenter.setContentView(image);
                    slideshow.setVisible(true);
                    publish();
                    completePending(status());
                }
                @Override public void onSessionEnded(Throwable error) {
                    if (request != sessionGeneration) return;
                    session = null; starting = false; presentationVisible = false;
                    if (image != null) image.clear();
                    image = null;
                    slideshow.setVisible(false);
                    if (!started) {
                        if (selected != null) selected.resumeAllowed = false;
                        slideshow.pause(slideshowState.owner);
                        resumeAfterBackground = false;
                        completePending(new JSObject().put("cancelled", true));
                    } else if (!resumed) resumeAfterBackground = true;
                    publish();
                    maybeResume();
                }
                @Override public void onContainerVisibilityChanged(boolean visible) {
                    if (request != sessionGeneration) return;
                    presentationVisible = visible;
                    slideshow.setVisible(visible);
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
            if (!owner.isEmpty() && (selected != null && owner.equals(selected.owner) || owner.equals(pendingOwner) || owner.equals(slideshowState.owner))) closePresentation(true);
            call.resolve(status());
        });
    }
    private void closePresentation(boolean clearSelection) {
        photoGeneration++; sessionGeneration++;
        WindowAreaSessionPresenter previous = session;
        session = null; starting = false; presentationVisible = false; resumeAfterBackground = false;
        if (image != null) image.clear();
        image = null;
        if (slideshow != null) {
            slideshow.setVisible(false);
            if (clearSelection) slideshow.stop();
        }
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
            if (slideshow != null) slideshow.dispose();
            if (controller != null) controller.removeWindowAreaInfoListListener(listener);
        });
        decoder.shutdown();
    }
}
