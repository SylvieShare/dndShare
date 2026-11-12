package ru.dndshare.client;

import android.graphics.Bitmap;
import android.graphics.Rect;
import android.webkit.CookieManager;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.MotionEvent;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Exercise the packaged shared reporter in Android WebView, without submitting to production. */
@RunWith(AndroidJUnit4.class)
public class ErrorReportUiTest {
    private String evaluate(ActivityScenario<MainActivity> activity, String script) throws Exception {
        var value = new AtomicReference<String>();
        var done = new CountDownLatch(1);
        activity.onActivity(host -> host.getBridge().getWebView().evaluateJavascript(script, result -> { value.set(result); done.countDown(); }));
        assertTrue("JavaScript callback timed out", done.await(15, TimeUnit.SECONDS));
        return value.get();
    }

    private void waitFor(ActivityScenario<MainActivity> activity, String condition) throws Exception {
        long deadline = System.currentTimeMillis() + 45000;
        while (System.currentTimeMillis() < deadline) {
            if ("true".equals(evaluate(activity, condition))) return;
            Thread.sleep(100);
        }
        fail("Condition timed out: " + condition + "; body=" + evaluate(activity, "document.body.innerText.slice(-800)"));
    }

    private void fourFingerTap(ActivityScenario<MainActivity> activity) throws Exception {
        waitFor(activity, "document.hasFocus()");
        int[] bounds = new int[4];
        activity.onActivity(host -> {
            var web = host.getBridge().getWebView();
            int[] location = new int[2]; web.getLocationOnScreen(location);
            var visible = new Rect(); web.getWindowVisibleDisplayFrame(visible);
            bounds[0] = location[0]; bounds[1] = Math.max(location[1], visible.top);
            bounds[2] = web.getWidth(); bounds[3] = Math.min(web.getHeight(), visible.bottom - bounds[1]);
            assertTrue("Report host must own the foreground window; finishing=" + host.isFinishing(), web.hasWindowFocus());
        });
        var properties = new MotionEvent.PointerProperties[4];
        var coordinates = new MotionEvent.PointerCoords[4];
        for (int i = 0; i < 4; i++) {
            properties[i] = new MotionEvent.PointerProperties();
            properties[i].id = i; properties[i].toolType = MotionEvent.TOOL_TYPE_FINGER;
            coordinates[i] = new MotionEvent.PointerCoords();
            coordinates[i].x = bounds[0] + bounds[2] * (.2f + i * .18f);
            coordinates[i].y = bounds[1] + bounds[3] * .25f;
            coordinates[i].pressure = 1; coordinates[i].size = .1f;
        }
        long down = SystemClock.uptimeMillis();
        for (int count = 1; count <= 4; count++) {
            int action = count == 1 ? MotionEvent.ACTION_DOWN : MotionEvent.ACTION_POINTER_DOWN | ((count - 1) << MotionEvent.ACTION_POINTER_INDEX_SHIFT);
            sendTouch(down, action, count, properties, coordinates);
        }
        for (int count = 4; count >= 1; count--) {
            int action = count == 1 ? MotionEvent.ACTION_UP : MotionEvent.ACTION_POINTER_UP | ((count - 1) << MotionEvent.ACTION_POINTER_INDEX_SHIFT);
            sendTouch(down, action, count, properties, coordinates);
        }
    }

    private void sendTouch(long down, int action, int count, MotionEvent.PointerProperties[] properties, MotionEvent.PointerCoords[] coordinates) {
        var event = MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, count, properties, coordinates, 0, 0, 1, 1, 0, 0, InputDevice.SOURCE_TOUCHSCREEN, 0);
        InstrumentationRegistry.getInstrumentation().sendPointerSync(event);
        event.recycle();
        SystemClock.sleep(20);
    }

    @Test public void sharedReporterCapturesAndSubmitsAndNativeBackCancelsSelection() throws Exception {
        // The dedicated emulator uses a guest session. The submission below is intercepted in JS.
        var cleared = new CountDownLatch(1);
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> CookieManager.getInstance().removeAllCookies(result -> cleared.countDown()));
        assertTrue(cleared.await(10, TimeUnit.SECONDS));
        try (var activity = ActivityScenario.launch(MainActivity.class)) {
            waitFor(activity, "!!document.getElementById('app')?.__vue_app__ && document.documentElement.dataset.platform==='android'");
            evaluate(activity, "window.__reportFetch=window.fetch;window.fetch=async function(url,options){if(new URL(url,location.href).pathname==='/api/error-reports'){window.__nativeReport=JSON.parse(options.body);return new Response(JSON.stringify({id:123}),{status:201,headers:{'Content-Type':'application/json'}})}return window.__reportFetch.apply(this,arguments)};const target=document.createElement('button');target.id='native-report-target';target.textContent='Report target';target.style.cssText='position:fixed;left:24px;top:120px;width:220px;height:90px;background:rgb(40,35,55);color:white;z-index:100';document.body.append(target);window.__reportRoute=location.href");
            fourFingerTap(activity);
            waitFor(activity, "!!document.querySelector('.selection-hint')");
            assertEquals("true", evaluate(activity, "!document.getElementById('error-report-form') && location.href===window.__reportRoute"));
            android.util.Log.i("ReportGestureTest", "First gesture completed: " + evaluate(activity, "JSON.stringify({focus:document.hasFocus(),hidden:document.hidden,selection:!!document.querySelector('.selection-hint')})"));
            activity.onActivity(host -> host.getOnBackPressedDispatcher().onBackPressed());
            waitFor(activity, "!document.querySelector('.selection-hint') && location.href===window.__reportRoute");
            android.util.Log.i("ReportGestureTest", "After cancelling selection: " + evaluate(activity, "JSON.stringify({focus:document.hasFocus(),hidden:document.hidden,selection:!!document.querySelector('.selection-hint')})"));
            fourFingerTap(activity);
            waitFor(activity, "!!document.querySelector('.selection-hint')");
            evaluate(activity, "document.getElementById('native-report-target').click()");
            waitFor(activity, "!!document.querySelector('.screenshot-preview')?.src.startsWith('data:image/jpeg;base64,')");
            evaluate(activity, "const field=document.getElementById('error-report-description');field.value='Ошибка в Android';field.dispatchEvent(new Event('input',{bubbles:true}))");
            waitFor(activity, "Array.from(document.querySelectorAll('.aem-footer button')).some(button=>button.textContent.trim()==='Отправить'&&!button.disabled)");
            File image = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null), "error-report-form.png");
            try (var output = new FileOutputStream(image)) {
                assertTrue(InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot().compress(Bitmap.CompressFormat.PNG, 100, output));
            }
            evaluate(activity, "Array.from(document.querySelectorAll('.aem-footer button')).find(button=>button.textContent.trim()==='Отправить').click()");
            waitFor(activity, "window.__nativeReport?.description==='Ошибка в Android' && !document.getElementById('error-report-form')");
            assertEquals("true", evaluate(activity, "window.__nativeReport.element.client==='android' && window.__nativeReport.element.selector==='#native-report-target' && window.__nativeReport.screenshot.startsWith('data:image/jpeg;base64,')"));
            evaluate(activity, "window.fetch=window.__reportFetch;document.getElementById('native-report-target').remove()");
        }
    }
}
