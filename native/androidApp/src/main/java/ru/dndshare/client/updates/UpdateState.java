package ru.dndshare.client.updates;

import android.util.AtomicFile;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

final class UpdateState {
    final File file;
    JSONObject data;
    private String saved;
    UpdateState(File root, String runtime) throws Exception {
        file = new File(root,"state.json");
        try (InputStream input = new AtomicFile(file).openRead()) { data = new JSONObject(new String(UpdateFiles.read(input,1024*1024),StandardCharsets.UTF_8)); }
        catch (Exception missing) { data = new JSONObject(); }
        if (data.optInt("format")!=1 || !runtime.equals(data.optString("runtime"))) data = new JSONObject().put("format",1).put("runtime",runtime).put("active","builtin").put("confirmed","builtin").put("previous","builtin").put("failed",new JSONArray());
        if (!data.has("viewToken")) data.put("viewToken",UUID.randomUUID().toString());
        saved=data.toString();
    }
    void save() throws Exception {
        String next=data.toString();
        try { UpdateFiles.atomic(file,next.getBytes(StandardCharsets.UTF_8)); saved=next; }
        catch(Exception error) { data=new JSONObject(saved); throw error; }
    }
    String active() { return data.optString("active","builtin"); }
    boolean failed(UpdateManifest manifest) {
        String key = manifest.data.optLong("build") + ":" + manifest.data.optString("sourceHash");
        JSONArray failures = data.optJSONArray("failed");
        if (failures != null) for (int index=0; index<failures.length(); index++) if (key.equals(failures.optString(index))) return true;
        return false;
    }
    void markFailed(UpdateManifest manifest) throws Exception {
        if (manifest == null || failed(manifest)) return;
        JSONArray previous = data.optJSONArray("failed"), next = new JSONArray();
        if (previous != null) for (int index=Math.max(0,previous.length()-31);index<previous.length();index++) next.put(previous.get(index));
        next.put(manifest.data.getLong("build") + ":" + manifest.data.getString("sourceHash"));
        data.put("failed",next);
    }
    Set<String> retained() {
        Set<String> keep = new HashSet<>();
        for (String field:new String[]{"active","confirmed","previous","pending"}) {
            String value=data.optString(field); if (value.matches("[0-9a-f]{64}")) keep.add(value);
        }
        return keep;
    }
}
