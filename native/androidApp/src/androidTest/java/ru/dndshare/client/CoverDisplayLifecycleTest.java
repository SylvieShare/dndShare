package ru.dndshare.client;

import android.graphics.Bitmap;
import android.os.SystemClock;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.Collections;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Feature-specific lifecycle checks do not depend on a software keyboard or OEM dual-screen support. */
@RunWith(AndroidJUnit4.class)
public class CoverDisplayLifecycleTest {
    private String js(ActivityScenario<MainActivity> activity, String script) throws Exception {
        var result = new AtomicReference<String>(); var done = new CountDownLatch(1);
        activity.onActivity(host -> host.getBridge().getWebView().evaluateJavascript(script, value -> { result.set(value); done.countDown(); }));
        assertTrue(done.await(10, TimeUnit.SECONDS)); return result.get();
    }
    private void waitFor(ActivityScenario<MainActivity> activity, String script) throws Exception {
        long deadline = SystemClock.elapsedRealtime() + 15000;
        while (SystemClock.elapsedRealtime() < deadline) { if ("true".equals(js(activity, script))) return; Thread.sleep(50); }
        fail("Cover lifecycle condition timed out: " + script);
    }
    private void loaded(ActivityScenario<MainActivity> activity) throws Exception {
        waitFor(activity, "!!window.Capacitor?.Plugins?.CoverDisplay && !!document.getElementById('app').__vue_app__");
    }
    private void status(ActivityScenario<MainActivity> activity) throws Exception {
        js(activity, "window.__coverLifecycle=null;window.Capacitor.Plugins.CoverDisplay.getStatus().then(value=>window.__coverLifecycle=value)");
        waitFor(activity, "!!window.__coverLifecycle");
    }
    private void seed(MainActivity host, boolean selected) {
        try {
            var field = CoverDisplayPlugin.class.getDeclaredField("slideshowState"); field.setAccessible(true);
            var state = (CoverSlideshow.State) field.get(null);
            state.owner = "lifecycle-character"; state.enabled = true; state.currentUid = selected ? "lifecycle-photo" : "";
            state.photos = Collections.singletonList(new CoverPhotoSource("lifecycle-photo", "https://127.0.0.1:1/missing.webp", "", 0, 2, 4));
            if (selected) ((CoverDisplayPlugin) host.getBridge().getPlugin("CoverDisplay").getInstance()).rememberPhoto(
                state.owner, state.currentUid, Bitmap.createBitmap(2, 4, Bitmap.Config.ARGB_8888));
        } catch (Exception error) { throw new AssertionError(error); }
    }
    @Test public void selectionAndAutomaticModeSurviveBackgroundReloadAndRecreationUntilStopOrLogout() throws Exception {
        try (var activity = ActivityScenario.launch(MainActivity.class)) {
            loaded(activity); activity.onActivity(host -> seed(host, true));
            activity.moveToState(Lifecycle.State.CREATED); activity.moveToState(Lifecycle.State.RESUMED);
            status(activity);
            assertEquals("true", js(activity, "__coverLifecycle.selected&&__coverLifecycle.autoplay&&__coverLifecycle.photoUid==='lifecycle-photo'"));
            js(activity, "window.__coverCancellationKept=false;window.Capacitor.Plugins.CoverDisplay.cancelPhoto({owner:'lifecycle-character',photoUid:'lifecycle-photo'}).then(value=>window.__coverCancellationKept=value.selected&&value.autoplay)");
            waitFor(activity, "window.__coverCancellationKept===true");
            js(activity, "window.__oldGalleryPage=true");
            activity.onActivity(host -> host.getBridge().getWebView().reload());
            waitFor(activity, "typeof window.__oldGalleryPage==='undefined' && !!document.getElementById('app').__vue_app__");
            loaded(activity); status(activity);
            assertEquals("true", js(activity, "__coverLifecycle.selected&&__coverLifecycle.autoplay"));
            activity.recreate(); loaded(activity); status(activity);
            assertEquals("true", js(activity, "__coverLifecycle.selected&&__coverLifecycle.autoplay"));
            js(activity, "window.__coverStopped=false;window.Capacitor.Plugins.CoverDisplay.hide({owner:'lifecycle-character'}).then(value=>window.__coverStopped=!value.selected&&!value.autoplay)");
            waitFor(activity, "window.__coverStopped===true");
            activity.onActivity(host -> seed(host, true));
            js(activity, "window.__coverLoggedOut=false;window.Capacitor.Plugins.LocalStore.clearSession().then(()=>window.__coverLoggedOut=true)");
            waitFor(activity, "window.__coverLoggedOut===true"); status(activity);
            assertEquals("true", js(activity, "!__coverLifecycle.selected&&!__coverLifecycle.autoplay"));
            activity.onActivity(host -> seed(host, true));
        }
        try (var activity = ActivityScenario.launch(MainActivity.class)) {
            loaded(activity); status(activity);
            assertEquals("true", js(activity, "!__coverLifecycle.selected&&!__coverLifecycle.autoplay"));
        }
    }
    @Test public void recreationDuringTheFirstLoadRestartsPreparationInsteadOfStrandingAutoplay() throws Exception {
        try (var activity = ActivityScenario.launch(MainActivity.class)) {
            loaded(activity); activity.onActivity(host -> seed(host, false));
            activity.recreate(); loaded(activity);
            // The intentionally unavailable localhost image must finish with an error,
            // proving that retained work restarted. Before the fix it stayed enabled forever.
            js(activity, "window.__coverRecovered=false;window.__coverPoll=setInterval(()=>window.Capacitor.Plugins.CoverDisplay.getStatus().then(value=>{if(!value.autoplay&&value.error){window.__coverRecovered=true;clearInterval(window.__coverPoll)}}),50)");
            waitFor(activity, "window.__coverRecovered===true");
        }
    }
}
