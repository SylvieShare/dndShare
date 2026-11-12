package ru.dndshare.client.updates;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import org.json.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;

/** Native-owned update lifecycle. No downloaded JavaScript participates in verification or rollback. */
public final class FrontendUpdates {
    private static final String PROCESS = UUID.randomUUID().toString();
    public interface Reload { void load(String directory); }
    final UpdateRuntime runtime;
    final UpdatePackages packages;
    final UpdateState state;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final String process;
    private final long readyTimeout;
    private final boolean automaticChecks;
    private Reload reloader;
    private boolean foreground, checking, closed, uiReady, storageDisabled;
    private long checkedAt;
    private String phase="idle", message="";
    private Runnable watchdog;
    private Runnable observer;
    private final Runnable periodic = new Runnable() { @Override public void run() { synchronized(FrontendUpdates.this) { if(closed || !foreground) return; check(false); main.postDelayed(this,60000); } } };

    public FrontendUpdates(Context context) throws Exception {
        this(UpdateRuntime.load(context), new File(context.getFilesDir(),"frontend-updates"),PROCESS,30000,true);
    }
    FrontendUpdates(UpdateRuntime runtime, File root, String process, long readyTimeout, boolean automaticChecks) throws Exception {
        this.runtime=runtime; this.process=process; this.readyTimeout=readyTimeout; this.automaticChecks=automaticChecks;
        packages=new UpdatePackages(root,runtime); state=new UpdateState(root,runtime.nativeRuntime);
    }
    public synchronized void attach(Reload reloader) { this.reloader=reloader; }
    public synchronized void observe(Runnable observer) { this.observer=observer; }
    private void changed() { main.post(() -> { synchronized(this) { if(!closed && observer!=null) observer.run(); } }); }
    private UpdateManifest cached(String id) {
        if (id.equals("builtin")) return null;
        try { return packages.read(id); } catch (Exception invalid) { return null; }
    }
    private JSONObject info(String id) throws Exception {
        UpdateManifest manifest=cached(id);
        return manifest == null ? new JSONObject(runtime.frontend.toString()).put("bundleId","builtin") : manifest.publicInfo();
    }
    private String fallback() {
        for (String field:new String[]{"confirmed","previous"}) {
            String id=state.data.optString(field,"builtin");
            UpdateManifest manifest=cached(id);
            if (manifest!=null && manifest.data.optLong("build")>=runtime.frontend.optLong("build")) return id;
        }
        return "builtin";
    }
    private String directory() { return state.active().equals("builtin") ? null : packages.directory(state.active()).getAbsolutePath(); }
    public synchronized String startup() throws Exception {
        try { return selectStartup(); }
        catch(Exception error) { unavailableStorage(); return directory(); }
    }
    private String selectStartup() throws Exception {
        JSONObject boot=state.data.optJSONObject("boot");
        if (boot!=null && !process.equals(boot.optString("process"))) rollback();
        if (!state.active().equals("builtin")) {
            UpdateManifest active=cached(state.active());
            if (active==null || active.data.optLong("build")<=runtime.frontend.optLong("build")) {
                state.data.put("active","builtin").put("confirmed","builtin").remove("boot");
            }
        }
        boolean fresh=!process.equals(state.data.optString("process"));
        if (fresh && !state.data.has("boot")) state.data.put("viewToken",UUID.randomUUID().toString());
        if (fresh || safeBackground()) selectPending();
        state.data.put("process",process).put("background",false).put("safe",false);
        state.save();
        return directory();
    }
    private boolean safeBackground() {
        return state.data.optBoolean("background") && state.data.optBoolean("safe") && state.data.optLong("checkpointAt")>=state.data.optLong("backgroundAt")-1000;
    }
    private boolean selectPending() throws Exception {
        String id=state.data.optString("pending");
        if (id.isEmpty()) return false;
        UpdateManifest candidate=cached(id);
        state.data.remove("pending");
        if (candidate==null || state.failed(candidate) || candidate.data.getLong("build")<=info(state.active()).getLong("build")) return false;
        String token=UUID.randomUUID().toString();
        uiReady=false;
        state.data.put("active",id).put("viewToken",token).put("boot",new JSONObject().put("token",token).put("process",process));
        message=""; phase="starting";
        return true;
    }
    private void rollback() throws Exception {
        uiReady=false;
        state.markFailed(cached(state.active()));
        state.data.put("active",fallback()).put("viewToken",UUID.randomUUID().toString()).remove("boot"); state.data.remove("pending");
        phase="rolledBack"; message="Обновление не запустилось. Восстановлена рабочая версия.";
        state.save();
        changed();
        Log.i("DnDShareUpdater","Frontend rollback completed");
    }
    private void unavailableStorage() throws Exception {
        storageDisabled=true;
        state.data.put("active",fallback()).put("viewToken",UUID.randomUUID().toString()).remove("boot");
        state.data.remove("pending");
        phase="error"; message="Не удалось записать данные обновления. Используется рабочая версия интерфейса.";
        changed();
    }
    public synchronized JSONObject status() throws Exception {
        JSONObject boot=state.data.optJSONObject("boot");
        JSONObject result=new JSONObject().put("active",info(state.active())).put("android",runtime.android).put("phase",phase).put("message",message).put("ready",uiReady)
            .put("bootToken",state.data.getString("viewToken"));
        String pending=state.data.optString("pending");
        if (!pending.isEmpty()) result.put("pending",info(pending));
        return result;
    }
    public synchronized void ready(String token, long build, String sourceHash) throws Exception {
        if (closed) throw new IllegalStateException("Frontend host was closed");
        JSONObject active=info(state.active()), boot=state.data.optJSONObject("boot");
        if (build!=active.getLong("build") || !sourceHash.equals(active.getString("sourceHash")) || !state.data.getString("viewToken").equals(token)) throw new SecurityException("Stale frontend readiness signal");
        if(storageDisabled) { uiReady=true; changed(); return; }
        String confirmed=state.data.optString("confirmed","builtin");
        if (!confirmed.equals(state.active())) state.data.put("previous",confirmed);
        state.data.put("confirmed",state.active()).remove("boot");
        try { state.save(); }
        catch(Exception error) { unavailableStorage(); if(reloader!=null) reloader.load(directory()); return; }
        uiReady=true; cancelWatchdog();
        changed();
        if ((phase.equals("starting") || phase.equals("idle")) && !checking) phase=state.data.has("pending")?"pending":"idle";
        worker.execute(() -> { synchronized(this) { if(!closed) try { packages.cleanup(state.retained()); } catch(Exception ignored) { } } });
        Log.i("DnDShareUpdater","Frontend ready: build="+build+" source="+(state.active().equals("builtin")?"APK":"OTA"));
    }
    private void cancelWatchdog() { if(watchdog!=null) main.removeCallbacks(watchdog); watchdog=null; }
    private void watchBoot() {
        cancelWatchdog(); if (!foreground || !state.data.has("boot")) return;
        String token=state.data.optJSONObject("boot").optString("token");
        watchdog=() -> { synchronized(this) {
            if (closed || !foreground || !token.equals(state.data.optJSONObject("boot")==null?"":state.data.optJSONObject("boot").optString("token"))) return;
            try { rollback(); if(reloader!=null) reloader.load(directory()); }
            catch(Exception error) { try { unavailableStorage(); if(reloader!=null) reloader.load(directory()); } catch(Exception ignored) { message="Не удалось восстановить интерфейс."; } }
        } };
        main.postDelayed(watchdog,readyTimeout);
    }
    public synchronized void foreground() {
        if (closed) return;
        foreground=true;
        main.removeCallbacks(periodic); main.postDelayed(periodic,60000);
        if(storageDisabled) { changed(); return; }
        try {
            if (safeBackground() && selectPending()) { state.save(); if(reloader!=null) reloader.load(directory()); }
            state.data.put("background",false).put("safe",false); state.save();
        } catch(Exception error) { message="Не удалось применить обновление."; }
        watchBoot(); changed(); check(false);
    }
    public synchronized void background(boolean configurationChange) {
        if (closed) return;
        foreground=false; cancelWatchdog(); main.removeCallbacks(periodic);
        if (!storageDisabled && !configurationChange) try { state.data.put("background",true).put("backgroundAt",SystemClock.elapsedRealtime()); state.save(); } catch(Exception ignored) { }
    }
    public synchronized void checkpoint(String token, boolean safe) throws Exception {
        if (closed || storageDisabled) return;
        String current=status().getString("bootToken");
        if (!current.equals(token)) return;
        state.data.put("safe",safe).put("checkpointAt",SystemClock.elapsedRealtime()); state.save();
    }
    public synchronized void applyPending(String token) throws Exception {
        if (closed) throw new IllegalStateException("Frontend host was closed");
        if (storageDisabled) throw new IOException("Хранилище обновлений недоступно.");
        if (!status().getString("bootToken").equals(token)) throw new SecurityException("Stale update request");
        if (selectPending()) { state.save(); if(reloader!=null) reloader.load(directory()); watchBoot(); }
    }
    public synchronized void check(boolean force) {
        if(storageDisabled) {
            if(!force) return;
            try { state.save(); storageDisabled=false; } catch(Exception error) { changed(); return; }
        }
        if (closed || !automaticChecks || checking || !force && checkedAt!=0 && SystemClock.elapsedRealtime()-checkedAt<15000) return;
        checking=true; checkedAt=SystemClock.elapsedRealtime(); phase="checking"; changed();
        worker.execute(() -> {
            File archive=null;
            try {
                UpdateManifest latest=UpdateManifest.verify(UpdateHttp.latest(runtime.updateUrl),runtime);
                synchronized(this) {
                    if (closed) return;
                    if (latest.data.getLong("build")<=info(state.active()).getLong("build")) { phase="idle"; message=""; return; }
                    if (!runtime.accepts(latest.data)) { phase="incompatible"; message="Для новой версии интерфейса нужна новая Android-сборка."; return; }
                    if (state.failed(latest)) { phase="rolledBack"; message="Ошибочная версия пропущена. Используется рабочий интерфейс."; return; }
                    if (latest.id.equals(state.data.optString("pending"))) { phase="pending"; return; }
                    phase="downloading";
                }
                archive=File.createTempFile("frontend-", ".part",packages.root);
                UpdateHttp.download(runtime.updateUrl,latest.id,latest.data.getLong("bundleBytes"),archive);
                synchronized(this) { if(closed) return; }
                packages.install(latest,archive);
                synchronized(this) { if(!closed) { state.data.put("pending",latest.id); state.save(); phase="pending"; message="Обновление интерфейса загружено."; Log.i("DnDShareUpdater","Frontend staged: build="+latest.data.getLong("build")); } }
            } catch(Exception error) { synchronized(this) { if(!closed) { phase="error"; message="Не удалось проверить или загрузить обновление. Текущая версия продолжает работать."; } } }
            finally { if(archive!=null) archive.delete(); synchronized(this) {checking=false; changed();} }
        });
    }
    public synchronized void close() { closed=true; cancelWatchdog(); main.removeCallbacks(periodic); observer=null; worker.shutdownNow(); }
}
