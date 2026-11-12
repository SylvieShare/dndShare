package ru.dndshare.client.updates;

import android.content.Context;
import org.json.JSONObject;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public final class UpdateRuntime {
    public final JSONObject frontend;
    public final JSONObject android;
    public final String publicKey, updateUrl, nativeRuntime;
    public final int apiContract, dataContract;
    public UpdateRuntime(JSONObject data) throws Exception {
        if (data.getInt("format") != 1 || !data.getString("applicationId").equals("ru.dndshare.client")) throw new IllegalArgumentException("Invalid updater runtime");
        frontend = data.getJSONObject("frontend"); android = data.getJSONObject("android");
        publicKey = data.getString("publicKey"); updateUrl = data.getString("updateUrl");
        nativeRuntime = frontend.getString("nativeRuntime"); apiContract = frontend.getInt("apiContract"); dataContract = frontend.getInt("dataContract");
    }
    public static UpdateRuntime load(Context context) throws Exception {
        try (InputStream input = context.getAssets().open("client-runtime.json")) {
            return new UpdateRuntime(new JSONObject(new String(UpdateFiles.read(input, 1024 * 1024), StandardCharsets.UTF_8)));
        }
    }
    boolean accepts(JSONObject candidate) {
        return nativeRuntime.equals(candidate.optString("nativeRuntime")) && apiContract == candidate.optInt("apiContract") && dataContract == candidate.optInt("dataContract");
    }
}
