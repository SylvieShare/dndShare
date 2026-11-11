package ru.dndshare.client;

import android.graphics.Bitmap;
import android.webkit.CookieManager;
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

    @Test public void sharedReporterCapturesAndSubmitsAndNativeBackCancelsSelection() throws Exception {
        // The dedicated emulator uses a guest session. The submission below is intercepted in JS.
        var cleared = new CountDownLatch(1);
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> CookieManager.getInstance().removeAllCookies(result -> cleared.countDown()));
        assertTrue(cleared.await(10, TimeUnit.SECONDS));
        try (var activity = ActivityScenario.launch(MainActivity.class)) {
            waitFor(activity, "!!document.getElementById('app')?.__vue_app__ && document.documentElement.dataset.platform==='android'");
            evaluate(activity, "window.__reportFetch=window.fetch;window.fetch=async function(url,options){if(new URL(url,location.href).pathname==='/api/error-reports'){window.__nativeReport=JSON.parse(options.body);return new Response(JSON.stringify({id:123}),{status:201,headers:{'Content-Type':'application/json'}})}return window.__reportFetch.apply(this,arguments)};const target=document.createElement('button');target.id='native-report-target';target.textContent='Report target';target.style.cssText='position:fixed;left:24px;top:120px;width:220px;height:90px;background:rgb(40,35,55);color:white;z-index:100';document.body.append(target);window.__reportRoute=location.href;window.dispatchEvent(new Event('dndshare:error-report-request'))");
            waitFor(activity, "!!document.querySelector('.selection-hint')");
            evaluate(activity, "window.dispatchEvent(new Event('dndshare:back',{cancelable:true}))");
            waitFor(activity, "!document.querySelector('.selection-hint') && location.href===window.__reportRoute");
            evaluate(activity, "window.dispatchEvent(new Event('dndshare:error-report-request'));document.getElementById('native-report-target').click()");
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
