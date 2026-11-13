package ru.dndshare.client;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.webkit.CookieManager;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Comparator;
import java.util.concurrent.ConcurrentHashMap;

/** Bounded compressed cache; only the currently displayed/transitioning images are decoded. */
final class CoverPhotoStore implements CoverSlideshow.Loader {
    private static final long MAX_CACHE = 256L * 1024 * 1024, MAX_IMAGE = 30L * 1024 * 1024;
    private static final String PROCESS_ID = java.util.UUID.randomUUID().toString();
    private static final java.util.concurrent.atomic.AtomicBoolean CLEANED = new java.util.concurrent.atomic.AtomicBoolean();
    private final File directory;
    private final ConcurrentHashMap<String, Object> locks = new ConcurrentHashMap<>();
    private final Object commits = new Object();
    private volatile int generation;
    CoverPhotoStore(Context context) { directory = new File(context.getCacheDir(), "cover-gallery"); directory.mkdirs(); }
    @Override public void describe(CoverPhotoSource photo) throws Exception {
        if (photo.width > 0 && photo.height > 0) return;
        int request = generation;
        File file;
        try { file = cached(photo, !photo.thumbnailUrl.isEmpty()); }
        catch (Exception unavailable) { if (request != generation) throw unavailable; file = cached(photo, false); }
        BitmapFactory.Options bounds = bounds(file);
        int orientation = orientation(file);
        boolean rotated = orientation >= ExifInterface.ORIENTATION_TRANSPOSE && orientation <= ExifInterface.ORIENTATION_ROTATE_270;
        photo.width = rotated ? bounds.outHeight : bounds.outWidth;
        photo.height = rotated ? bounds.outWidth : bounds.outHeight;
    }
    @Override public Bitmap load(CoverPhotoSource photo) throws Exception {
        File file = cached(photo, false);
        BitmapFactory.Options options = bounds(file);
        options.inJustDecodeBounds = false;
        options.inSampleSize = 1;
        while ((Math.max(options.outWidth, options.outHeight) + options.inSampleSize - 1) / options.inSampleSize > 2560) options.inSampleSize *= 2;
        Bitmap bitmap = BitmapFactory.decodeFile(file.getAbsolutePath(), options);
        if (bitmap == null) throw new IOException("Не удалось открыть фотографию");
        Matrix matrix = new Matrix();
        switch (orientation(file)) {
            case ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.setScale(-1, 1);
            case ExifInterface.ORIENTATION_ROTATE_180 -> matrix.setRotate(180);
            case ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.setScale(1, -1);
            case ExifInterface.ORIENTATION_TRANSPOSE -> { matrix.setRotate(90); matrix.postScale(-1, 1); }
            case ExifInterface.ORIENTATION_ROTATE_90 -> matrix.setRotate(90);
            case ExifInterface.ORIENTATION_TRANSVERSE -> { matrix.setRotate(270); matrix.postScale(-1, 1); }
            case ExifInterface.ORIENTATION_ROTATE_270 -> matrix.setRotate(270);
            default -> { return bitmap; }
        }
        Bitmap rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
        if (rotated != bitmap) bitmap.recycle();
        return rotated;
    }
    @Override public void prefetch(CoverPhotoSource photo) throws Exception { cached(photo, false); }
    @Override public void cancel() { synchronized (commits) { generation++; } }
    private File cached(CoverPhotoSource photo, boolean thumbnail) throws Exception {
        int request = generation;
        if (CLEANED.compareAndSet(false, true)) {
            File[] abandoned = directory.listFiles(file -> file.getName().endsWith(".part") && !file.getName().startsWith(PROCESS_ID));
            if (abandoned != null) for (File file : abandoned) file.delete();
        }
        String address = thumbnail ? photo.thumbnailUrl : photo.url;
        String identity = photo.imageId > 0 ? Long.toString(photo.imageId) : URI.create(address).getHost() + URI.create(address).getPath();
        byte[] digest = MessageDigest.getInstance("SHA-256").digest((identity + (thumbnail ? ":thumb" : ":full")).getBytes(StandardCharsets.UTF_8));
        StringBuilder encoded = new StringBuilder();
        for (byte value : digest) encoded.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
        String key = encoded.toString();
        synchronized (locks.computeIfAbsent(key, unused -> new Object())) {
            File target = new File(directory, key);
            if (target.isFile()) { target.setLastModified(System.currentTimeMillis()); return target; }
            File temporary = File.createTempFile(PROCESS_ID + "-" + key + "-", ".part", directory);
            try {
                try { download(address, temporary, request); }
                catch (Exception unavailable) {
                    if (thumbnail || photo.imageId <= 0 || request != generation || Thread.currentThread().isInterrupted()) throw unavailable;
                    download("https://dndshare.ru/api/storage/images/" + photo.imageId, temporary, request);
                }
                bounds(temporary);
                synchronized (commits) {
                    if (request != generation) throw new IOException("Загрузка фотографии отменена");
                    Files.move(temporary.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING);
                    trim(target);
                }
                return target;
            } finally { temporary.delete(); }
        }
    }
    private void download(String address, File file, int request) throws Exception {
        URL url = URI.create(address.startsWith("/") ? "https://dndshare.ru" + address : address).toURL();
        for (int redirect = 0; redirect < 6; redirect++) {
            if (request != generation) throw new IOException("Загрузка фотографии отменена");
            if (!"https".equalsIgnoreCase(url.getProtocol())) throw new IOException("Недопустимый адрес фотографии");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(10000); connection.setReadTimeout(15000); connection.setInstanceFollowRedirects(false);
            if ("dndshare.ru".equalsIgnoreCase(url.getHost())) {
                String cookies = CookieManager.getInstance().getCookie("https://dndshare.ru");
                if (cookies != null) connection.setRequestProperty("Cookie", cookies);
            }
            try {
                int status = connection.getResponseCode();
                if (status >= 300 && status < 400 && connection.getHeaderField("Location") != null) { url = new URL(url, connection.getHeaderField("Location")); continue; }
                if (status != 200 || connection.getContentLengthLong() > MAX_IMAGE) throw new IOException("Не удалось загрузить фотографию");
                try (var input = connection.getInputStream(); var output = Files.newOutputStream(file.toPath())) {
                    byte[] buffer = new byte[65536]; long size = 0; int read;
                    while ((read = input.read(buffer)) != -1) {
                        size += read;
                        if (size > MAX_IMAGE || request != generation || Thread.currentThread().isInterrupted()) throw new IOException("Загрузка фотографии отменена");
                        output.write(buffer, 0, read);
                    }
                }
                return;
            } finally { connection.disconnect(); }
        }
        throw new IOException("Не удалось получить фотографию после перенаправления");
    }
    private static BitmapFactory.Options bounds(File file) throws IOException {
        BitmapFactory.Options options = new BitmapFactory.Options(); options.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(file.getAbsolutePath(), options);
        if (options.outWidth <= 0 || options.outHeight <= 0 || Math.max(options.outWidth, options.outHeight) > 16383) throw new IOException("Неподдерживаемая фотография");
        return options;
    }
    private static int orientation(File file) {
        try (var input = new FileInputStream(file)) { return new ExifInterface(input).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL); }
        catch (Exception ignored) { return ExifInterface.ORIENTATION_NORMAL; }
    }
    private synchronized void trim(File keep) {
        File[] files = directory.listFiles(file -> !file.getName().endsWith(".part"));
        if (files == null) return;
        long size = Arrays.stream(files).mapToLong(File::length).sum();
        Arrays.sort(files, Comparator.comparingLong(File::lastModified));
        for (File file : files) if (size > MAX_CACHE && !file.equals(keep)) { long bytes = file.length(); if (file.delete()) size -= bytes; }
    }
    static void clear(Context context) {
        File[] files = new File(context.getCacheDir(), "cover-gallery").listFiles();
        if (files != null) for (File file : files) file.delete();
    }
}
