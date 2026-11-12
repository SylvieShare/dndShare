package ru.dndshare.client.updates;

import org.json.JSONObject;
import java.io.*;
import java.util.*;
import java.util.zip.*;

final class UpdatePackages {
    private static final Object STORAGE = new Object();
    final File root, bundles, receipts;
    final UpdateRuntime runtime;
    private final Map<String, UpdateManifest> verified = new java.util.concurrent.ConcurrentHashMap<>();
    UpdatePackages(File root, UpdateRuntime runtime) throws Exception {
        this.root = root; this.runtime = runtime;
        bundles = new File(root, "bundles"); receipts = new File(root, "receipts");
    }
    File directory(String id) { if (!id.matches("[0-9a-f]{64}")) throw new IllegalArgumentException("Invalid bundle ID"); return new File(bundles, id); }
    UpdateManifest read(String id) throws Exception {
        directory(id);
        UpdateManifest cached = verified.get(id);
        if (cached != null) return cached;
        synchronized(STORAGE) { return readLocked(id); }
    }
    private UpdateManifest readLocked(String id) throws Exception {
        directory(id);
        if (verified.containsKey(id)) return verified.get(id);
        File receipt = new File(receipts, id + ".json");
        byte[] bytes;
        try (InputStream input = new FileInputStream(receipt)) { bytes = UpdateFiles.read(input, 2 * 1024 * 1024); }
        UpdateManifest manifest = UpdateManifest.verify(bytes, runtime);
        if (!manifest.id.equals(id) || !runtime.accepts(manifest.data)) throw new SecurityException("Incompatible cached frontend");
        verifyFiles(manifest, directory(id));
        verified.put(id, manifest);
        return manifest;
    }
    private void verifyFiles(UpdateManifest manifest, File directory) throws Exception {
        for (Map.Entry<String, JSONObject> entry : manifest.files.entrySet()) {
            File file = new File(directory, entry.getKey());
            if (!file.isFile() || file.length() != entry.getValue().getLong("size") || !UpdateFiles.hash(file).equals(entry.getValue().getString("sha256"))) throw new SecurityException("Frontend file is damaged");
        }
    }
    void install(UpdateManifest manifest, File archive) throws Exception {
        synchronized(STORAGE) { installLocked(manifest,archive); }
    }
    private void installLocked(UpdateManifest manifest, File archive) throws Exception {
        if ((!bundles.exists() && !bundles.mkdirs()) || (!receipts.exists() && !receipts.mkdirs())) throw new IOException("Cannot open frontend storage");
        if (!runtime.accepts(manifest.data)) throw new SecurityException("Native runtime is incompatible");
        if (archive.length() != manifest.data.getLong("bundleBytes") || !UpdateFiles.hash(archive).equals(manifest.id)) throw new SecurityException("Frontend archive checksum is invalid");
        if (directory(manifest.id).exists()) {
            try { read(manifest.id); return; }
            catch (Exception damaged) { UpdateFiles.delete(root, directory(manifest.id)); verified.remove(manifest.id); }
        }
        File stage = new File(bundles, "staging-" + UUID.randomUUID());
        if (!stage.mkdir()) throw new IOException("Cannot create frontend staging directory");
        try {
            Set<String> seen = new HashSet<>();
            try (ZipInputStream zip = new ZipInputStream(new FileInputStream(archive))) {
                ZipEntry entry;
                while ((entry = zip.getNextEntry()) != null) {
                    String name = entry.getName();
                    JSONObject expected = manifest.files.get(name);
                    if (entry.isDirectory() || !UpdateFiles.validPath(name) || expected == null || !seen.add(name)) throw new SecurityException("Unexpected frontend zip entry");
                    File file = new File(stage, name);
                    if (!file.getCanonicalPath().startsWith(stage.getCanonicalPath() + File.separator)) throw new SecurityException("Unsafe zip path");
                    if (!file.getParentFile().exists() && !file.getParentFile().mkdirs()) throw new IOException("Cannot create frontend directory");
                    long size = 0; byte[] buffer = new byte[65536]; int count;
                    try (FileOutputStream output = new FileOutputStream(file)) {
                        while ((count = zip.read(buffer)) != -1) { size += count; if (size > expected.getLong("size")) throw new SecurityException("Frontend file size mismatch"); output.write(buffer, 0, count); }
                        output.getFD().sync();
                    }
                    zip.closeEntry();
                }
            }
            if (seen.size() != manifest.files.size()) throw new SecurityException("Frontend archive is incomplete");
            verifyFiles(manifest, stage);
            UpdateFiles.atomic(new File(receipts, manifest.id + ".json"), manifest.envelope);
            if (!stage.renameTo(directory(manifest.id))) throw new IOException("Cannot activate staged frontend files");
            verified.put(manifest.id, manifest);
        } finally { if (stage.exists()) UpdateFiles.delete(root, stage); }
    }
    void cleanup(Set<String> keep) throws IOException {
        synchronized(STORAGE) { cleanupLocked(keep); }
    }
    private void cleanupLocked(Set<String> keep) throws IOException {
        File[] children = bundles.listFiles();
        if (children != null) for (File child : children) if (!keep.contains(child.getName())) {
            UpdateFiles.delete(root, child);
            verified.remove(child.getName());
            File receipt = new File(receipts, child.getName() + ".json");
            if (receipt.exists()) UpdateFiles.delete(root, receipt);
        }
    }
}
