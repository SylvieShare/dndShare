package ru.dndshare.client;

import android.os.ParcelFileDescriptor;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class SystemChromeTest {
    private String shell(String command) throws Exception {
        try (var descriptor = InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command);
             var input = new ParcelFileDescriptor.AutoCloseInputStream(descriptor)) {
            return new String(input.readAllBytes(), StandardCharsets.UTF_8).trim();
        }
    }

    @Test public void statusBarFollowsWindowWidthWithoutReservingAnEmptyNativeStrip() throws Exception {
        assertEquals("This test resizes an emulator only", "1", shell("getprop ro.kernel.qemu"));
        String original = shell("wm size");
        String previous = original.contains("Override size:") ? original.split("Override size:")[1].trim() : "reset";
        float density = InstrumentationRegistry.getInstrumentation().getTargetContext().getResources().getDisplayMetrics().density;
        try (var activity = ActivityScenario.launch(MainActivity.class)) {
            for (int width : new int[]{390, 834, 1440, 390}) {
                shell("wm size " + Math.round(width * density) + "x" + Math.round(1100 * density));
                boolean expectedVisible = width < 600;
                var correct = new AtomicBoolean();
                long deadline = System.currentTimeMillis() + 10000;
                while (!correct.get() && System.currentTimeMillis() < deadline) {
                    activity.onActivity(host -> {
                        var decor = host.getWindow().getDecorView();
                        var insets = ViewCompat.getRootWindowInsets(decor);
                        correct.set(insets != null && insets.isVisible(WindowInsetsCompat.Type.statusBars()) == expectedVisible
                            && !insets.isVisible(WindowInsetsCompat.Type.navigationBars())
                            && host.getBridge().getWebView().getHeight() == decor.getHeight()
                            && host.getResources().getConfiguration().screenWidthDp == width);
                    });
                    if (!correct.get()) Thread.sleep(100);
                }
                assertTrue("Wrong bars or empty native strip at " + width + "dp", correct.get());
            }
        } finally { shell("wm size " + previous); }
    }
}
