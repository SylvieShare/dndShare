package ru.dndshare.client.updates;

import android.util.AtomicFile;
import java.io.*;
import java.security.MessageDigest;

final class UpdateFiles {
    static byte[] read(InputStream input, long limit) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[65536]; int count; long size = 0;
        while ((count = input.read(buffer)) != -1) { size += count; if (size > limit) throw new IOException("Update size limit exceeded"); output.write(buffer, 0, count); }
        return output.toByteArray();
    }
    static String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte value : bytes) result.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
        return result.toString();
    }
    static String hash(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[65536]; int count;
            while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
        }
        return hex(digest.digest());
    }
    static void atomic(File file, byte[] bytes) throws IOException {
        if (!file.getParentFile().exists() && !file.getParentFile().mkdirs()) throw new IOException("Cannot create update directory");
        AtomicFile atomic = new AtomicFile(file);
        FileOutputStream output = null;
        try { output = atomic.startWrite(); output.write(bytes); atomic.finishWrite(output); }
        catch (IOException error) { if (output != null) atomic.failWrite(output); throw error; }
    }
    static void delete(File root, File target) throws IOException {
        if (!target.getCanonicalPath().startsWith(root.getCanonicalPath() + File.separator)) throw new IOException("Invalid cleanup path");
        if (target.isDirectory()) {
            File[] children = target.listFiles();
            if (children != null) for (File child : children) delete(root, child);
        }
        if (target.exists() && !target.delete()) throw new IOException("Cannot remove update file");
    }
    static boolean validPath(String name) {
        if (!name.matches("[A-Za-z0-9_./-]+") || name.startsWith("/")) return false;
        for (String part : name.split("/", -1)) if (part.isEmpty() || part.equals(".") || part.equals("..")) return false;
        return !name.toLowerCase(java.util.Locale.ROOT).matches(".*\\.(apk|dex|jar|class|so|dylib)$");
    }
}
