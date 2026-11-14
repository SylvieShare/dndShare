package ru.dndshare.client;

import android.app.Instrumentation;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.SystemClock;
import android.util.Log;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.BridgeWebViewClient;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Real WebView long-press/touch input against packaged Vue and a fake API only. */
@RunWith(AndroidJUnit4.class)
public class WeaponDragTouchTest {
    private static final Instrumentation INSTRUMENTATION = InstrumentationRegistry.getInstrumentation();
    private static final String GRID = "document.querySelector('[data-sortable-container=weapons]')";
    private final List<String> nativeEvents = new ArrayList<>();
    private FakeApi api;
    private String scenario = "probe";
    private int diagnosticCount;
    private JSONObject ghostEvidence;
    private final float[] touchFrame = new float[3];

    // Runs before the packaged module. Observe the network below the Android
    // offline adapter, retaining its actual journal, snapshot and PATCH pipeline.
    private static final String BOOTSTRAP = """
        <script>
        window.__weaponNative={boot:crypto.randomUUID(),events:[],errors:[]};
        for(const type of ['pointerdown','pointermove','pointerup','pointercancel','touchstart','touchmove','touchend','touchcancel','contextmenu','dragstart'])
          document.addEventListener(type,e=>{const record={type,time:performance.now(),target:e.target.tagName,pointerId:e.pointerId,x:e.clientX,y:e.clientY,cancelable:e.cancelable};
            window.__weaponNative.events.push(record);setTimeout(()=>{record.prevented=e.defaultPrevented;record.ghost=!!document.querySelector('.sortable-ghost');record.drop=!!document.querySelector('.w-card--drop-target')},0)},true);
        addEventListener('error',e=>window.__weaponNative.errors.push(e.message));
        const realFetch=window.fetch.bind(window);
        window.fetch=function(input,init={}){const url=new URL(typeof input==='string'?input:input.url,location.href);
          if(url.pathname==='/api/char/test/data'&&(init.method||input.method||'GET').toUpperCase()==='PATCH') NativeWeaponApi.recordPatch(init.body);
          return realFetch(input,init)};
        </script>
        """;

    public static final class FakeApi {
        final JSONObject fixture;
        final JSONObject character;
        final JSONArray writes = new JSONArray();
        final JSONArray requests = new JSONArray();
        JSONObject acknowledgement = new JSONObject();
        int version = 1;
        int patchRequests;
        String error;

        FakeApi(JSONObject value) throws Exception {
            fixture = value;
            character = new JSONObject(value.getJSONObject("responses").getJSONObject("/api/char/test").toString());
        }

        private static Object child(Object parent, Object key) throws Exception {
            if (key instanceof JSONObject selector) {
                JSONArray rows = (JSONArray) parent;
                for (int i = 0; i < rows.length(); i++) if (selector.get("id").equals(rows.getJSONObject(i).opt(selector.getString("idField")))) return rows.get(i);
                throw new IllegalArgumentException("Missing fixture row: " + selector);
            }
            return ((JSONObject) parent).get(key.toString());
        }

        @JavascriptInterface public synchronized void recordPatch(String text) {
            try {
                JSONObject body = new JSONObject(text);
                writes.put(body);
                JSONArray patches = body.getJSONArray("patches");
                for (int i = 0; i < patches.length(); i++) {
                    JSONObject patch = patches.getJSONObject(i);
                    JSONArray path = patch.getJSONArray("path");
                    Object parent = character.getJSONObject("data");
                    for (int part = 0; part < path.length() - 1; part++) parent = child(parent, path.get(part));
                    String key = path.getString(path.length() - 1);
                    if (patch.getString("op").equals("set")) ((JSONObject) parent).put(key, patch.get("value"));
                    else if (patch.getString("op").equals("order")) {
                        JSONArray previous = ((JSONObject) parent).getJSONArray(key), order = patch.getJSONArray("value"), next = new JSONArray();
                        for (int id = 0; id < order.length(); id++) {
                            Object match = child(previous, new JSONObject().put("idField", patch.getString("idField")).put("id", order.get(id)));
                            next.put(match);
                        }
                        assertEquals(previous.length(), next.length());
                        ((JSONObject) parent).put(key, next);
                    } else throw new IllegalArgumentException("Unexpected fixture operation: " + patch);
                }
                acknowledgement = new JSONObject().put("fromVersion", version).put("version", ++version)
                    .put("mutationId", body.get("mutationId")).put("patches", patches);
                character.put("version", version);
            } catch (Throwable failure) { error = failure.toString(); }
        }

        synchronized WebResourceResponse respond(WebResourceRequest request) {
            try {
                String path = request.getUrl().getPath();
                requests.put(request.getMethod() + " " + request.getUrl());
                Object payload;
                if (path.equals("/api/char/test/data")) { patchRequests++; payload = acknowledgement; }
                else if (path.equals("/api/char/test")) payload = character;
                else if (path.equals("/api/char/test/changes")) payload = new JSONObject().put("fromVersion", version).put("version", version).put("patches", new JSONArray());
                else if (path.equals("/api/items/by-ids")) {
                    JSONArray items = new JSONArray();
                    for (String id : request.getUrl().getQueryParameter("ids").split(",")) {
                        Object item = fixture.getJSONObject("items").opt(id);
                        if (item != null) items.put(item);
                    }
                    payload = new JSONObject().put("items", items);
                } else payload = fixture.getJSONObject("responses").opt(path);
                if (payload == null) payload = new JSONObject();
                return json(payload.toString());
            } catch (Exception failure) { error = failure.toString(); return json("{}"); }
        }
    }

    private static WebResourceResponse json(String body) {
        return new WebResourceResponse("application/json", "UTF-8", 200, "OK", Map.of("Cache-Control", "no-store"),
            new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)));
    }

    private String evaluate(ActivityScenario<MainActivity> activity, String script) throws Exception {
        var result = new AtomicReference<String>(); var done = new CountDownLatch(1);
        activity.onActivity(host -> host.getBridge().getWebView().evaluateJavascript(script, value -> { result.set(value); done.countDown(); }));
        assertTrue("WebView JavaScript callback timed out", done.await(10, TimeUnit.SECONDS));
        return result.get();
    }

    private Object value(ActivityScenario<MainActivity> activity, String script) throws Exception {
        return new JSONTokener(evaluate(activity, script)).nextValue();
    }

    private void await(ActivityScenario<MainActivity> activity, String condition) throws Exception {
        await(activity, condition, 25000);
    }

    private void await(ActivityScenario<MainActivity> activity, String condition, long timeout) throws Exception {
        long deadline = SystemClock.elapsedRealtime() + timeout;
        while (SystemClock.elapsedRealtime() < deadline) {
            if ("true".equals(evaluate(activity, condition))) return;
            SystemClock.sleep(100);
        }
        fail("Timed out: " + condition + "\n" + diagnostics(activity));
    }

    private ActivityScenario<MainActivity> openFixture() throws Exception {
        // Only this test's fake account is used on the dedicated emulator.
        INSTRUMENTATION.getTargetContext().deleteDatabase("dndshare-web.db");
        api = new FakeApi(new JSONObject(new String(INSTRUMENTATION.getContext().getAssets().open("weapon-drag-api.json").readAllBytes(), StandardCharsets.UTF_8)));
        nativeEvents.clear();
        var routeLoaded = new CountDownLatch(1);
        var activity = ActivityScenario.launch(MainActivity.class);
        activity.onActivity(host -> {
            // Isolate the fixture from previously installed or concurrently published OTA packages.
            usePackagedUpdater(host);
            var bridge = host.getBridge(); var web = bridge.getWebView(); var packaged = bridge.getWebViewClient();
            web.getSettings().setBlockNetworkLoads(true);
            web.addJavascriptInterface(api, "NativeWeaponApi");
            web.setOnTouchListener((view, event) -> { synchronized (nativeEvents) { nativeEvents.add(event.getActionMasked() + ":" + event.getX() + "," + event.getY() + ":" + event.getEventTime()); } return false; });
            bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
                @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    if (request.getUrl().getPath().startsWith("/api/")) return api.respond(request);
                    WebResourceResponse response = packaged.shouldInterceptRequest(view, request);
                    if (request.isForMainFrame() && response != null && response.getMimeType().contains("html")) {
                        try {
                            String html = new String(response.getData().readAllBytes(), StandardCharsets.UTF_8).replace("<head>", "<head>" + BOOTSTRAP);
                            return new WebResourceResponse("text/html", "UTF-8", new ByteArrayInputStream(html.getBytes(StandardCharsets.UTF_8)));
                        } catch (Exception failure) { throw new IllegalStateException(failure); }
                    }
                    return response;
                }
                @Override public void onPageFinished(WebView view, String url) {
                    packaged.onPageFinished(view, url);
                    Log.i("WeaponDragTouchTest", "Fixture page finished: " + url);
                    if (url.contains("/char/test?tab=weapons")) routeLoaded.countDown();
                }
            });
            web.clearCache(true);
            bridge.setServerAssetPath("public");
            // setServerAssetPath also posts a root navigation; restore our route after it.
            web.post(() -> web.loadUrl("https://dndshare.ru/char/test?tab=weapons"));
        });
        assertTrue("Packaged fixture route did not finish; requests=" + api.requests, routeLoaded.await(30, TimeUnit.SECONDS));
        await(activity, "!!window.__weaponNative && !!" + GRID + " && " + GRID + ".querySelectorAll('.w-card').length===3");
        await(activity, GRID + ".querySelector('.w-name')?.textContent==='Native Spear' && " + GRID + ".querySelectorAll('.system-die').length>=3");
        await(activity, "document.hasFocus()");
        return activity;
    }

    private static void usePackagedUpdater(MainActivity host) {
        try {
            host.getFrontendUpdates().close();
            Class<?> type = ru.dndshare.client.updates.FrontendUpdates.class;
            var constructor = type.getDeclaredConstructor(ru.dndshare.client.updates.UpdateRuntime.class, File.class, String.class, long.class, boolean.class);
            constructor.setAccessible(true);
            var updater = (ru.dndshare.client.updates.FrontendUpdates) constructor.newInstance(
                ru.dndshare.client.updates.UpdateRuntime.load(host), new File(host.getCacheDir(), "weapon-test-updates-" + java.util.UUID.randomUUID()), "weapon-test", 30000L, false);
            updater.startup(); updater.attach(host::loadFrontendDirectory);
            var field = MainActivity.class.getDeclaredField("frontendUpdates"); field.setAccessible(true); field.set(host, updater);
        } catch (Exception error) { throw new IllegalStateException("Cannot isolate the packaged frontend for the weapon test", error); }
    }

    private JSONObject rect(ActivityScenario<MainActivity> activity, String selector) throws Exception {
        Object result = value(activity, "document.querySelector(" + JSONObject.quote(selector) + ")?.getBoundingClientRect().toJSON()");
        if (!(result instanceof JSONObject)) fail("Missing rectangle: " + selector + "\n" + diagnostics(activity));
        return (JSONObject) result;
    }

    private void send(ActivityScenario<MainActivity> activity, long down, int action, float x, float y) throws Exception {
        MotionEvent.PointerProperties properties = new MotionEvent.PointerProperties(); properties.id = 0; properties.toolType = MotionEvent.TOOL_TYPE_FINGER;
        MotionEvent.PointerCoords coords = new MotionEvent.PointerCoords(); coords.x = touchFrame[0] + x * touchFrame[2]; coords.y = touchFrame[1] + y * touchFrame[2]; coords.pressure = action == MotionEvent.ACTION_UP ? 0 : 1; coords.size = .1f;
        MotionEvent event = MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, 1, new MotionEvent.PointerProperties[]{properties}, new MotionEvent.PointerCoords[]{coords}, 0, 0, 1, 1, 0, 0, InputDevice.SOURCE_TOUCHSCREEN, 0);
        INSTRUMENTATION.sendPointerSync(event); event.recycle();
    }

    private long hold(ActivityScenario<MainActivity> activity, float x, float y) throws Exception {
        double width = ((Number) value(activity, "innerWidth")).doubleValue();
        activity.onActivity(host -> { var web = host.getBridge().getWebView(); int[] location = new int[2]; web.getLocationOnScreen(location); touchFrame[0] = location[0]; touchFrame[1] = location[1]; touchFrame[2] = (float) (web.getWidth() / width); });
        long down = SystemClock.uptimeMillis(); send(activity, down, MotionEvent.ACTION_DOWN, x, y);
        SystemClock.sleep(900); // Real WebView/native long-press timers, without clock mocking or CDP.
        return down;
    }

    private void moveAndRelease(ActivityScenario<MainActivity> activity, long down, float x, float y, float toX, float toY) throws Exception {
        for (int step = 1; step <= 12; step++) { send(activity, down, MotionEvent.ACTION_MOVE, x + (toX - x) * step / 12, y + (toY - y) * step / 12); SystemClock.sleep(25); }
        send(activity, down, MotionEvent.ACTION_UP, toX, toY);
        SystemClock.sleep(800);
    }

    private String diagnostics(ActivityScenario<MainActivity> activity) throws Exception {
        Object snapshot = value(activity, "({url:location.href,boot:window.__weaponNative?.boot,viewport:[innerWidth,innerHeight,devicePixelRatio],events:window.__weaponNative?.events,errors:window.__weaponNative?.errors,order:[...document.querySelectorAll('[data-sortable-container=weapons] .w-card')].map(e=>e.dataset.sortableKey),body:document.body?.innerText.slice(0,1200)})");
        JSONObject details = snapshot instanceof JSONObject ? (JSONObject) snapshot : new JSONObject().put("navigationInProgress", true);
        details.put("nativeEvents", new JSONArray(nativeEvents)).put("writes", api.writes).put("apiRequests", api.requests).put("apiError", api.error).put("ghost", ghostEvidence);
        String output = details.toString(2);
        Log.i("WeaponDragTouchTest", output);
        File target = new File(INSTRUMENTATION.getTargetContext().getExternalFilesDir(null), "weapon-drag-" + InstrumentationRegistry.getArguments().getString("probe", "native") + "-" + scenario + "-" + diagnosticCount++ + ".json");
        try (var stream = new FileOutputStream(target)) { stream.write(output.getBytes(StandardCharsets.UTF_8)); }
        return output;
    }

    private void assertSaved(ActivityScenario<MainActivity> activity, String expected) throws Exception {
        String order = "[..." + GRID + ".querySelectorAll('.w-card')].map(e=>e.dataset.sortableKey).join(',')";
        try {
            await(activity, order + "===" + JSONObject.quote(expected), 5000);
            assertNull("Fake API rejected the production PATCH", api.error);
            assertTrue("A native gesture must reach the API adapter", api.patchRequests > 0);
            assertTrue("Expected an explicit order patch", api.writes.toString().contains("\"op\":\"order\""));
            diagnostics(activity);
            String previousBoot = value(activity, "window.__weaponNative.boot").toString();
            activity.onActivity(host -> host.getBridge().getWebView().reload());
            await(activity, "!!window.__weaponNative && window.__weaponNative.boot!==" + JSONObject.quote(previousBoot) + " && !!" + GRID + " && " + order + "===" + JSONObject.quote(expected));
        } finally { diagnostics(activity); }
    }

    @Test public void nativeLongPressDropsInsideTileAndReloads() throws Exception {
        scenario = "inside";
        try (var activity = openFixture()) {
            JSONObject first = rect(activity, "[data-sortable-key=native-spear] .w-name"), second = rect(activity, "[data-sortable-key=native-sword] .w-name");
            float x = (float) first.getDouble("x") + 8, y = (float) first.getDouble("y") + 8;
            long down = hold(activity, x, y);
            moveAndRelease(activity, down, x, y, (float) second.getDouble("x") + 8, (float) second.getDouble("y") + 8);
            assertSaved(activity, "native-sword,native-spear,native-bow");
        }
    }

    @Test public void nativeLongPressDropsBetweenTilesAndReloads() throws Exception {
        scenario = "gap";
        try (var activity = openFixture()) {
            JSONObject first = rect(activity, "[data-sortable-key=native-spear]"), second = rect(activity, "[data-sortable-key=native-sword]");
            float x = (float) first.getDouble("x") + 30, y = (float) first.getDouble("y") + 30;
            boolean columns = second.getDouble("x") > first.getDouble("right");
            float toX = columns ? (float) ((first.getDouble("right") + second.getDouble("x")) / 2) : x;
            float toY = columns ? y : (float) ((first.getDouble("bottom") + second.getDouble("y")) / 2);
            long down = hold(activity, x, y); moveAndRelease(activity, down, x, y, toX, toY);
            assertSaved(activity, "native-sword,native-spear,native-bow");
        }
    }

    @Test public void nativeLongPressDropsAtTheListEndAndReloads() throws Exception {
        scenario = "list-end";
        try (var activity = openFixture()) {
            JSONObject first = rect(activity, "[data-sortable-key=native-spear]"), last = rect(activity, "[data-sortable-key=native-bow]"), list = rect(activity, "[data-sortable-container=weapons]");
            float x = (float) first.getDouble("x") + 30, y = (float) first.getDouble("y") + 30;
            float toY = (float) ((last.getDouble("bottom") + list.getDouble("bottom")) / 2);
            Assume.assumeTrue("The list end must be visible for this gesture", toY < ((Number) value(activity, "innerHeight")).doubleValue() - 5);
            long down = hold(activity, x, y);
            moveAndRelease(activity, down, x, y, (float) last.getDouble("x") + 30, toY);
            assertSaved(activity, "native-sword,native-bow,native-spear");
        }
    }

    private Bitmap screenshot(String name) throws Exception {
        Bitmap image = INSTRUMENTATION.getUiAutomation().takeScreenshot(); assertNotNull(image);
        try (var stream = new FileOutputStream(new File(INSTRUMENTATION.getTargetContext().getExternalFilesDir(null), name))) { image.compress(Bitmap.CompressFormat.PNG, 100, stream); }
        return image;
    }

    private int brightPixels(ActivityScenario<MainActivity> activity, Bitmap bitmap, JSONObject rect) throws Exception {
        float[] offset = new float[3]; double width = ((Number) value(activity, "innerWidth")).doubleValue();
        activity.onActivity(host -> { int[] location = new int[2]; var web = host.getBridge().getWebView(); web.getLocationOnScreen(location); offset[0] = location[0]; offset[1] = location[1]; offset[2] = (float) (web.getWidth() / width); });
        int count = 0;
        for (int y = (int) (offset[1] + rect.getDouble("y") * offset[2]); y < offset[1] + rect.getDouble("bottom") * offset[2]; y++)
            for (int x = (int) (offset[0] + rect.getDouble("x") * offset[2]); x < offset[0] + rect.getDouble("right") * offset[2]; x++) {
                int pixel = bitmap.getPixel(x, y), max = Math.max(Color.red(pixel), Math.max(Color.green(pixel), Color.blue(pixel))), min = Math.min(Color.red(pixel), Math.min(Color.green(pixel), Color.blue(pixel)));
                if (max > 120 && max - min > 45) count++;
            }
        return count;
    }

    @Test public void nativeHeldGhostKeepsBrightDiceAndPrivateIds() throws Exception {
        scenario = "ghost";
        try (var activity = openFixture()) {
            JSONObject die = rect(activity, "[data-sortable-key=native-spear] .system-die"), first = rect(activity, "[data-sortable-key=native-spear] .w-name");
            Bitmap before = screenshot("weapon-drag-before.png"); int brightBefore = brightPixels(activity, before, die); before.recycle();
            float x = (float) first.getDouble("x") + 8, y = (float) first.getDouble("y") + 8; long down = hold(activity, x, y);
            try {
                await(activity, "!!document.querySelector('.sortable-ghost')");
                JSONObject ghost = (JSONObject) value(activity, "(()=>{const g=document.querySelector('.sortable-ghost');return {inert:g.inert,hidden:g.getAttribute('aria-hidden'),duplicates:[...g.querySelectorAll('[id]')].filter(e=>document.querySelectorAll('[id=\"'+e.id+'\"]').length!==1).map(e=>e.id),clipVisibility:[...g.querySelectorAll('clipPath')].map(e=>getComputedStyle(document.getElementById(e.id)).visibility)}})()");
                ghostEvidence = ghost;
                Log.i("WeaponDragTouchTest", "Ghost=" + ghost);
                Bitmap held = screenshot("weapon-drag-held.png"); int brightHeld = brightPixels(activity, held, die); held.recycle();
                ghost.put("brightBefore", brightBefore).put("brightHeld", brightHeld);
                assertTrue("Die must have bright liquid before hold: " + brightBefore, brightBefore > 25);
                assertTrue("Held die lost its liquid: " + brightHeld + "/" + brightBefore, brightHeld > brightBefore * .65);
                assertEquals("Ghost SVG must resolve to its own visible defs: " + ghost, 0, ghost.getJSONArray("duplicates").length());
                assertTrue(ghost.getBoolean("inert")); assertEquals("true", ghost.getString("hidden"));
            } finally { send(activity, down, MotionEvent.ACTION_UP, x, y); diagnostics(activity); }
        }
    }
}
