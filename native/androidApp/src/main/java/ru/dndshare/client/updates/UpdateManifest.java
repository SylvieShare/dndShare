package ru.dndshare.client.updates;

import android.util.Base64;
import org.json.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.X509EncodedKeySpec;
import java.util.*;

final class UpdateManifest {
    final JSONObject data;
    final byte[] envelope;
    final String id;
    final Map<String, JSONObject> files = new LinkedHashMap<>();
    private UpdateManifest(JSONObject data, byte[] envelope) throws Exception {
        this.data = data; this.envelope = envelope; id = data.getString("bundleSha256");
        if (!id.matches("[0-9a-f]{64}") || data.getInt("format") != 1 || !data.getString("applicationId").equals("ru.dndshare.client")) throw new SecurityException("Invalid frontend manifest");
        if (data.getLong("bundleBytes") <= 0 || data.getLong("bundleBytes") > 64L * 1024 * 1024 || data.getLong("unpackedBytes") > 128L * 1024 * 1024) throw new SecurityException("Update is too large");
        if (data.getLong("build") < 1 || !data.getString("version").matches("[0-9]+\\.[0-9]+\\.[0-9]+")) throw new SecurityException("Invalid frontend version");
        if (!data.getString("sourceHash").matches("[0-9a-f]{64}") || !data.getString("nativeRuntime").matches("[0-9a-f]{64}") || data.getInt("apiContract")<1 || data.getInt("dataContract")<1 || data.getString("commitSha").isEmpty()) throw new SecurityException("Invalid frontend identity");
        JSONArray entries = data.getJSONArray("files");
        if (entries.length() == 0 || entries.length() > 2048) throw new SecurityException("Invalid update file count");
        long total = 0;
        for (int index = 0; index < entries.length(); index++) {
            JSONObject file = entries.getJSONObject(index);
            String name = file.getString("path"); long size = file.getLong("size");
            if (!UpdateFiles.validPath(name) || size < 0 || size > 32L * 1024 * 1024 || !file.getString("sha256").matches("[0-9a-f]{64}") || files.put(name, file) != null) throw new SecurityException("Invalid update file");
            total += size;
        }
        if (!files.containsKey("index.html") || total != data.getLong("unpackedBytes")) throw new SecurityException("Invalid frontend entrypoint");
    }
    static UpdateManifest verify(byte[] envelope, UpdateRuntime runtime) throws Exception {
        JSONObject wrapper = new JSONObject(new String(envelope, StandardCharsets.UTF_8));
        byte[] payload = Base64.decode(wrapper.getString("payload"), Base64.DEFAULT);
        byte[] signature = Base64.decode(wrapper.getString("signature"), Base64.DEFAULT);
        String pem = runtime.publicKey.replace("-----BEGIN PUBLIC KEY-----", "").replace("-----END PUBLIC KEY-----", "").replaceAll("\\s", "");
        PublicKey key = KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(Base64.decode(pem, Base64.DEFAULT)));
        Signature verifier = Signature.getInstance("SHA256withECDSA"); verifier.initVerify(key); verifier.update(payload);
        if (!verifier.verify(signature)) throw new SecurityException("Frontend signature is invalid");
        return new UpdateManifest(new JSONObject(new String(payload, StandardCharsets.UTF_8)), envelope);
    }
    JSONObject publicInfo() throws Exception {
        JSONObject value = new JSONObject();
        for (String key : new String[]{"version", "build", "commitSha", "sourceHash", "nativeRuntime", "apiContract", "dataContract"}) value.put(key, data.get(key));
        value.put("bundleId", id);
        return value;
    }
}
