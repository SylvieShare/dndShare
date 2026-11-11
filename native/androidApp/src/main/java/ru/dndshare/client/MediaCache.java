package ru.dndshare.client;

import android.content.Context;
import android.net.Uri;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import java.io.File;
import java.io.FileInputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.concurrent.ConcurrentHashMap;

/** Lazy bounded file cache. The persistent document database is never evicted here. */
final class MediaCache {
    private static final long MAX_BYTES = 256L * 1024 * 1024;
    private final File directory;
    private final ConcurrentHashMap<String, Object> locks = new ConcurrentHashMap<>();
    MediaCache(Context context) { directory = new File(context.getCacheDir(), "web-media"); directory.mkdirs(); }
    WebResourceResponse intercept(WebResourceRequest request) {
        Uri uri = request.getUrl();
        String extension = MimeTypeMap.getFileExtensionFromUrl(uri.toString()).toLowerCase(java.util.Locale.ROOT);
        if (!"GET".equals(request.getMethod()) || !"https".equals(uri.getScheme()) ||
            !Arrays.asList("png", "jpg", "jpeg", "webp", "gif", "svg", "glb", "gltf", "bin", "ktx2", "mp3", "ogg", "wav").contains(extension) ||
            request.getRequestHeaders().keySet().stream().anyMatch(key -> key.equalsIgnoreCase("Range"))) return null;
        String key;
        try {
            Uri.Builder stable = uri.buildUpon().clearQuery();
            for (String name : uri.getQueryParameterNames()) if (!name.toLowerCase(java.util.Locale.ROOT).startsWith("x-amz-")) {
                for (String value : uri.getQueryParameters(name)) stable.appendQueryParameter(name, value);
            }
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(stable.build().toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder encoded = new StringBuilder();
            for (byte value : digest) encoded.append(String.format("%02x", value & 255));
            key = encoded.toString();
        } catch (Exception ignored) { return null; }
        Object lock = locks.computeIfAbsent(key, unused -> new Object());
        synchronized (lock) {
            try {
                File cached = new File(directory, key + "." + extension);
                if (!cached.exists()) {
                    HttpURLConnection connection = (HttpURLConnection) URI.create(uri.toString()).toURL().openConnection();
                    connection.setConnectTimeout(10000);
                    connection.setReadTimeout(30000);
                    try {
                        if (connection.getResponseCode() != 200 || connection.getContentLengthLong() > MAX_BYTES) return null;
                        File temporary = new File(directory, key + ".partial");
                        try (var input = connection.getInputStream(); var output = Files.newOutputStream(temporary.toPath())) {
                            byte[] buffer = new byte[65536];
                            long size = 0;
                            int read;
                            while ((read = input.read(buffer)) != -1) {
                                size += read;
                                if (size > MAX_BYTES) throw new java.io.IOException("Media cache size exceeded");
                                output.write(buffer, 0, read);
                            }
                        } catch (Exception error) { temporary.delete(); throw error; }
                        Files.move(temporary.toPath(), cached.toPath(), StandardCopyOption.REPLACE_EXISTING);
                    } finally { connection.disconnect(); }
                }
                cached.setLastModified(System.currentTimeMillis());
                var input = new FileInputStream(cached);
                trim(cached);
                String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
                if (extension.equals("glb")) mime = "model/gltf-binary";
                if (extension.equals("ktx2")) mime = "image/ktx2";
                var headers = new HashMap<String, String>();
                headers.put("Access-Control-Allow-Origin", "https://dndshare.ru");
                headers.put("Content-Length", Long.toString(cached.length()));
                return new WebResourceResponse(mime == null ? "application/octet-stream" : mime, null, 200, "OK", headers, input);
            } catch (Exception ignored) { return null; }
        }
    }
    private void trim(File keep) {
        File[] files = directory.listFiles(file -> !file.getName().endsWith(".partial"));
        if (files == null) return;
        long total = Arrays.stream(files).mapToLong(File::length).sum();
        Arrays.sort(files, Comparator.comparingLong(File::lastModified));
        for (File file : files) if (total > MAX_BYTES && !file.equals(keep)) { long size = file.length(); if (file.delete()) total -= size; }
    }
    static void clear(Context context) {
        File[] files = new File(context.getCacheDir(), "web-media").listFiles();
        if (files != null) for (File file : files) file.delete();
    }
}
