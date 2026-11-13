package ru.dndshare.client;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.os.SystemClock;
import android.view.View;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class CoverSlideshowTest {
    private static CoverPhotoSource photo(String id, int width, int height) { return new CoverPhotoSource(id, "https://example.com/" + id, "", 0, width, height); }
    private static void ui(Runnable task) { InstrumentationRegistry.getInstrumentation().runOnMainSync(task); }
    private static void waitFor(BooleanSupplier condition) throws Exception {
        long deadline = SystemClock.elapsedRealtime() + 5000;
        while (!condition.getAsBoolean() && SystemClock.elapsedRealtime() < deadline) Thread.sleep(20);
        assertTrue("Native slideshow condition timed out", condition.getAsBoolean());
    }
    private static final class FakeLoader implements CoverSlideshow.Loader {
        final CountDownLatch landscapeStarted = new CountDownLatch(1), releaseLandscape = new CountDownLatch(1);
        boolean blockLandscape, failFirst;
        @Override public void describe(CoverPhotoSource photo) { }
        @Override public Bitmap load(CoverPhotoSource photo) throws Exception {
            if (failFirst && photo.uid.equals("portrait-a")) throw new Exception("Offline photo");
            if (blockLandscape && photo.uid.equals("landscape")) {
                landscapeStarted.countDown();
                if (!releaseLandscape.await(5, TimeUnit.SECONDS)) throw new Exception("Test timed out");
            }
            return Bitmap.createBitmap(4, 4, Bitmap.Config.ARGB_8888);
        }
        @Override public void prefetch(CoverPhotoSource photo) { }
    }
    private static final class Harness implements AutoCloseable {
        final CoverSlideshow.State state = new CoverSlideshow.State();
        final List<String> displayed = new CopyOnWriteArrayList<>();
        CoverSlideshow engine;
        Harness(FakeLoader loader) { ui(() -> engine = new CoverSlideshow(state, loader, new CoverSlideshow.Listener() {
            @Override public void changed() { }
            @Override public void ready(String owner, CoverPhotoSource source, Bitmap bitmap) { displayed.add(source.uid); }
            @Override public void failed(String message) { }
        })); }
        void start() { ui(() -> {
            engine.setViewport(300, 600);
            engine.configure("character", Arrays.asList(photo("portrait-a", 300, 600), photo("portrait-b", 400, 600), photo("landscape", 600, 300)), false);
            engine.setVisible(true);
        }); }
        @Override public void close() { ui(() -> { engine.stop(); engine.dispose(); }); }
    }
    @Test public void selectionUsesOrientationAndCyclesInGalleryOrderWithoutImmediateRepeats() {
        List<CoverPhotoSource> photos = Arrays.asList(photo("portrait-a", 300, 600), photo("portrait-b", 400, 600), photo("landscape", 600, 300), photo("square", 200, 200));
        assertEquals("portrait-a", CoverPhotoSource.choose(photos, "", 300, 600, false, Collections.emptySet()).uid);
        assertEquals("portrait-b", CoverPhotoSource.choose(photos, "portrait-a", 300, 600, true, Collections.emptySet()).uid);
        assertEquals("landscape", CoverPhotoSource.choose(photos, "portrait-a", 600, 300, false, Collections.emptySet()).uid);
        assertEquals("square", CoverPhotoSource.choose(photos.subList(2, 4), "", 300, 600, false, Collections.emptySet()).uid);
        assertEquals("landscape", CoverPhotoSource.choose(photos.subList(2, 3), "", 300, 600, false, Collections.emptySet()).uid);
    }
    @Test public void minuteDeadlineRotationPauseAndDeletionKeepAConsistentCurrentPhoto() throws Exception {
        try (Harness test = new Harness(new FakeLoader())) {
            test.start(); waitFor(() -> test.displayed.size() == 1);
            ui(() -> {
                long remaining = test.state.nextAt - SystemClock.elapsedRealtime();
                assertTrue(remaining > 59000 && remaining <= CoverSlideshow.INTERVAL_MS);
                test.engine.setVisible(false);
                test.state.nextAt = SystemClock.elapsedRealtime() - 1;
                test.engine.setVisible(true);
            });
            waitFor(() -> test.displayed.size() == 2);
            assertEquals("portrait-b", test.displayed.get(1));
            ui(() -> test.engine.setViewport(600, 300));
            waitFor(() -> test.displayed.contains("landscape"));
            ui(() -> test.engine.configure("character", Arrays.asList(photo("portrait-a", 300, 600)), true));
            waitFor(() -> test.displayed.get(test.displayed.size() - 1).equals("portrait-a"));
            ui(() -> {
                test.engine.pause("character");
                assertFalse(test.state.enabled);
                assertEquals("portrait-a", test.state.currentUid);
                test.engine.advance();
            });
            int count = test.displayed.size();
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            assertEquals(count, test.displayed.size());
            // Re-enabling the same gallery must complete a fresh request too.
            ui(() -> test.engine.configure("character", test.state.photos, false));
            waitFor(() -> test.displayed.size() == count + 1);
        }
    }
    @Test public void aLateLandscapeDecodeCannotReplaceThePhotoAfterRotatingBack() throws Exception {
        FakeLoader loader = new FakeLoader(); loader.blockLandscape = true;
        try (Harness test = new Harness(loader)) {
            test.start(); waitFor(() -> test.displayed.size() == 1);
            ui(() -> test.engine.setViewport(600, 300));
            assertTrue(loader.landscapeStarted.await(5, TimeUnit.SECONDS));
            ui(() -> test.engine.setViewport(300, 600));
            loader.releaseLandscape.countDown();
            Thread.sleep(150);
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            assertEquals(Arrays.asList("portrait-a"), test.displayed);
            ui(() -> assertEquals("portrait-a", test.state.currentUid));
        } finally { loader.releaseLandscape.countDown(); }
    }
    @Test public void rotationReconsidersTheBestFitEvenIfTheOldFallbackHasTheNewOrientation() throws Exception {
        try (Harness test = new Harness(new FakeLoader())) {
            ui(() -> {
                test.engine.setViewport(300, 900);
                test.engine.configure("character", Arrays.asList(photo("wide-a", 600, 500), photo("wide-b", 900, 300)), false);
                test.engine.setVisible(true);
            });
            waitFor(() -> test.displayed.size() == 1);
            assertEquals("wide-a", test.displayed.get(0));
            ui(() -> test.engine.setViewport(900, 300));
            waitFor(() -> test.displayed.size() == 2);
            assertEquals("wide-b", test.displayed.get(1));
        }
    }
    @Test public void oneFailedPhotoDoesNotBlockThePlaylistAndCancellationWinsOverLoading() throws Exception {
        FakeLoader loader = new FakeLoader(); loader.failFirst = true; loader.blockLandscape = true;
        try (Harness test = new Harness(loader)) {
            test.start(); waitFor(() -> !test.displayed.isEmpty());
            assertEquals("portrait-b", test.displayed.get(0));
            ui(() -> test.engine.setViewport(600, 300));
            assertTrue(loader.landscapeStarted.await(5, TimeUnit.SECONDS));
            ui(() -> test.engine.stop());
            loader.releaseLandscape.countDown(); Thread.sleep(150);
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            ui(() -> { assertFalse(test.state.enabled); assertEquals("", test.state.owner); assertTrue(test.state.photos.isEmpty()); });
            assertEquals(Arrays.asList("portrait-b"), test.displayed);
        } finally { loader.releaseLandscape.countDown(); }
    }
    @Test public void presentationCropsTheCenterAndReportsItsOwnRotatedSize() {
        ui(() -> {
            List<String> sizes = new java.util.ArrayList<>();
            CoverPhotoView view = new CoverPhotoView(InstrumentationRegistry.getInstrumentation().getTargetContext(), (width, height) -> sizes.add(width + "x" + height));
            Bitmap source = Bitmap.createBitmap(40, 20, Bitmap.Config.ARGB_8888);
            source.setDensity(Bitmap.DENSITY_NONE);
            for (int y = 0; y < 20; y++) for (int x = 0; x < 40; x++) source.setPixel(x, y, new int[] { Color.RED, Color.GREEN, Color.BLUE, Color.YELLOW }[x / 10]);
            view.show(source, false);
            view.measure(View.MeasureSpec.makeMeasureSpec(20, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(20, View.MeasureSpec.EXACTLY));
            view.layout(0, 0, 20, 20);
            Bitmap cropped = Bitmap.createBitmap(20, 20, Bitmap.Config.ARGB_8888);
            cropped.setDensity(Bitmap.DENSITY_NONE);
            view.draw(new Canvas(cropped));
            assertEquals(Color.GREEN, cropped.getPixel(2, 10)); assertEquals(Color.BLUE, cropped.getPixel(17, 10));
            view.measure(View.MeasureSpec.makeMeasureSpec(40, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(20, View.MeasureSpec.EXACTLY));
            view.layout(0, 0, 40, 20);
            assertEquals(Arrays.asList("20x20", "40x20"), sizes);
            view.clear(); assertEquals(2, view.getChildCount());
        });
    }
}
