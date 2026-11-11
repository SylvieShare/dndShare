package ru.dndshare.client;

import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class HybridShellTest {
    private String evaluate(ActivityScenario<MainActivity> activity, String script) throws Exception {
        var result = new AtomicReference<String>();
        var done = new CountDownLatch(1);
        activity.onActivity(host -> host.getBridge().getWebView().evaluateJavascript(script, value -> { result.set(value); done.countDown(); }));
        assertTrue("JavaScript callback timed out", done.await(15, TimeUnit.SECONDS));
        return result.get();
    }
    private void waitFor(ActivityScenario<MainActivity> activity, String script) throws Exception {
        long deadline = System.currentTimeMillis() + 30000;
        while (System.currentTimeMillis() < deadline) {
            if ("true".equals(evaluate(activity, script))) return;
            Thread.sleep(100);
        }
        fail("Condition timed out: " + script + "; body=" + evaluate(activity, "document.body.innerText.slice(0,500)"));
    }
    @Test public void packagedFrontendAndSqliteSurviveActivityRecreation() throws Exception {
        try (var activity = ActivityScenario.launch(MainActivity.class)) {
            waitFor(activity, "!!window.Capacitor?.Plugins?.LocalStore && !!document.getElementById('app').__vue_app__");
            assertEquals("\"https://dndshare.ru\"", evaluate(activity, "location.origin"));
            evaluate(activity, "window.__storageTest=false;window.Capacitor.Plugins.LocalStore.batch({changes:[{key:'test:atomic',value:JSON.stringify({saved:42})}]}).then(()=>window.__storageTest=true)");
            waitFor(activity, "window.__storageTest===true");
            activity.recreate();
            waitFor(activity, "!!window.Capacitor?.Plugins?.LocalStore && !!document.getElementById('app').__vue_app__");
            evaluate(activity, "window.__storageResult=null;window.Capacitor.Plugins.LocalStore.get({key:'test:atomic'}).then(result=>window.__storageResult=JSON.parse(result.value).saved)");
            waitFor(activity, "window.__storageResult===42");
            evaluate(activity, "window.__rolledBack=false;window.Capacitor.Plugins.LocalStore.batch({changes:[{key:'test:rollback',value:'1'},{value:'invalid'}]}).catch(()=>window.Capacitor.Plugins.LocalStore.get({key:'test:rollback'})).then(result=>window.__rolledBack=result.value===null)");
            waitFor(activity, "window.__rolledBack===true");
            // Large map snapshots/outboxes must not hit Android CursorWindow's row limit.
            evaluate(activity, "window.__large=false;window.Capacitor.Plugins.LocalStore.batch({changes:[{key:'test:large',value:'x'.repeat(3*1024*1024)}]}).then(()=>window.Capacitor.Plugins.LocalStore.get({key:'test:large'})).then(result=>window.__large=result.value.length===3*1024*1024)");
            waitFor(activity, "window.__large===true");
            evaluate(activity, "window.Capacitor.Plugins.LocalStore.clear({prefix:'test:'})");
            // The same renderer used by maps must expose WebGL2 on the target emulator.
            assertEquals("true", evaluate(activity, "!!document.createElement('canvas').getContext('webgl2')"));
            evaluate(activity, "window.__coverStatus=null;window.Capacitor.Plugins.CoverDisplay.getStatus().then(value=>window.__coverStatus=value)");
            waitFor(activity, "typeof window.__coverStatus?.available==='boolean'");
            assertEquals("false", evaluate(activity, "window.__coverStatus.available"));
            evaluate(activity, "window.__coverRejected=false;window.Capacitor.Plugins.CoverDisplay.show({owner:'test',photoUid:'photo',data:'AAAA'}).catch(()=>window.__coverRejected=true)");
            waitFor(activity, "window.__coverRejected===true");
        }
    }
}
