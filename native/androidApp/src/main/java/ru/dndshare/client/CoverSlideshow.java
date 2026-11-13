package ru.dndshare.client;

import android.graphics.Bitmap;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** App-session slideshow. All selection/timer state belongs to the main thread, never a WebView timer. */
final class CoverSlideshow {
    static final long INTERVAL_MS = 60000;
    static final class State {
        String owner = "", currentUid = "";
        boolean enabled;
        long nextAt;
        List<CoverPhotoSource> photos = Collections.emptyList();
    }
    interface Loader {
        void describe(CoverPhotoSource photo) throws Exception;
        Bitmap load(CoverPhotoSource photo) throws Exception;
        void prefetch(CoverPhotoSource photo) throws Exception;
        default void cancel() { }
    }
    interface Listener {
        void changed();
        void ready(String owner, CoverPhotoSource photo, Bitmap bitmap);
        void failed(String message);
    }
    final State state;
    private final Loader loader;
    private final Listener listener;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newFixedThreadPool(2);
    private final Set<String> failed = new HashSet<>();
    private volatile int generation;
    private volatile int requestGeneration;
    private int width = 1, height = 2;
    private volatile boolean disposed;
    private boolean visible, preparing;
    boolean loading;
    String error = "";
    private final Runnable timer = this::advance;
    CoverSlideshow(State state, Loader loader, Listener listener) { this.state = state; this.loader = loader; this.listener = listener; }
    void configure(String owner, List<CoverPhotoSource> photos, boolean update) {
        if (update && (!state.enabled || !state.owner.equals(owner))) return;
        if (photos.isEmpty()) { stop(); return; }
        String current = update && state.owner.equals(owner) ? state.currentUid : "";
        for (CoverPhotoSource photo : photos) for (CoverPhotoSource previous : state.photos) {
            if (photo.uid.equals(previous.uid) && photo.width <= 0) { photo.width = previous.width; photo.height = previous.height; }
        }
        cancelWork();
        state.owner = owner; state.enabled = true; state.photos = new ArrayList<>(photos);
        state.currentUid = photos.stream().anyMatch(photo -> photo.uid.equals(current)) ? current : "";
        if (!update || state.currentUid.isEmpty()) state.nextAt = 0;
        loading = true; preparing = true; error = "";
        int request = generation;
        listener.changed();
        worker.execute(() -> {
            for (CoverPhotoSource photo : photos) {
                if (!current(request)) return;
                try { loader.describe(photo); } catch (Exception ignored) { /* A failed photo never blocks the remaining gallery. */ }
            }
            handler.post(() -> {
                if (!current(request)) return;
                preparing = false; loading = false;
                request(false);
            });
        });
    }
    private boolean current(int value) { return !disposed && value == generation; }
    void setViewport(int width, int height) {
        if (width <= 0 || height <= 0) return;
        boolean changed = (width > height) != (this.width > this.height);
        this.width = width; this.height = height;
        if (changed && state.enabled && !preparing) { failed.clear(); state.nextAt = 0; request(false, true); }
        listener.changed();
    }
    int width() { return width; }
    int height() { return height; }
    void setVisible(boolean value) {
        visible = value;
        handler.removeCallbacks(timer);
        if (!value || !state.enabled || preparing || loading) return;
        if (state.nextAt > 0 && state.nextAt <= SystemClock.elapsedRealtime()) advance();
        else { request(false); schedule(); }
    }
    void advance() {
        if (!visible || !state.enabled || preparing || disposed) return;
        failed.clear(); state.nextAt = 0; request(true);
    }
    private void request(boolean advance) {
        request(advance, false);
    }
    private void request(boolean advance, boolean bestFit) {
        if (disposed || !state.enabled || preparing) return;
        int request = ++requestGeneration, configuration = generation;
        CoverPhotoSource next = CoverPhotoSource.choose(state.photos, bestFit ? "" : state.currentUid, width, height, advance, failed);
        if (next == null) {
            loading = false; error = "Не удалось загрузить фотографии для внешнего экрана";
            if (state.currentUid.isEmpty()) state.enabled = false;
            listener.failed(error); listener.changed(); schedule(); return;
        }
        if (next.uid.equals(state.currentUid)) { loading = false; listener.changed(); schedule(); return; }
        loading = true; handler.removeCallbacks(timer); listener.changed();
        worker.execute(() -> {
            if (!current(configuration) || request != requestGeneration) return;
            try {
                Bitmap bitmap = loader.load(next);
                handler.post(() -> {
                    if (!current(configuration) || request != requestGeneration || !state.enabled) return;
                    state.currentUid = next.uid;
                    state.nextAt = visible ? SystemClock.elapsedRealtime() + INTERVAL_MS : 0;
                    loading = false; error = "";
                    listener.ready(state.owner, next, bitmap);
                    listener.changed(); schedule(); prefetch(configuration);
                });
            } catch (Exception unavailable) {
                handler.post(() -> {
                    if (!current(configuration) || request != requestGeneration) return;
                    failed.add(next.uid); request(advance, bestFit);
                });
            }
        });
    }
    private void schedule() {
        handler.removeCallbacks(timer);
        if (!visible || !state.enabled || loading || disposed) return;
        if (state.nextAt == 0) state.nextAt = SystemClock.elapsedRealtime() + INTERVAL_MS;
        handler.postDelayed(timer, Math.max(1, state.nextAt - SystemClock.elapsedRealtime()));
    }
    private void prefetch(int request) {
        List<CoverPhotoSource> photos = new ArrayList<>(state.photos);
        CoverPhotoSource next = CoverPhotoSource.choose(photos, state.currentUid, width, height, true, failed);
        CoverPhotoSource rotated = CoverPhotoSource.choose(photos, "", height, width, false, failed);
        worker.execute(() -> {
            for (CoverPhotoSource photo : new CoverPhotoSource[] { rotated, next }) {
                if (!current(request)) return;
                if (photo != null) try { loader.prefetch(photo); } catch (Exception ignored) { /* Keep the visible image if offline. */ }
            }
        });
    }
    void pause(String owner) {
        if (!state.owner.equals(owner)) return;
        cancelWork(); state.enabled = false; state.nextAt = 0; listener.changed();
    }
    void stop() {
        cancelWork(); state.enabled = false; state.owner = ""; state.currentUid = "";
        state.nextAt = 0; state.photos = Collections.emptyList(); error = ""; listener.changed();
    }
    private void cancelWork() {
        generation++; requestGeneration++; failed.clear(); loading = false; preparing = false;
        loader.cancel();
        handler.removeCallbacks(timer);
    }
    void dispose() { cancelWork(); disposed = true; worker.shutdownNow(); }
}
