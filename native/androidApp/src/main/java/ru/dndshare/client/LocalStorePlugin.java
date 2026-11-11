package ru.dndshare.client;

import android.content.ContentValues;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.webkit.CookieManager;
import android.app.Activity;
import android.content.Intent;
import android.print.PrintManager;
import android.content.Context;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Transactional storage only: no game rules, HTTP or second synchronization engine. */
@CapacitorPlugin(name = "LocalStore")
public class LocalStorePlugin extends Plugin {
    private SQLiteOpenHelper database;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    @Override public void load() {
        database = new SQLiteOpenHelper(getContext(), "dndshare-web.db", null, 1) {
            @Override public void onCreate(SQLiteDatabase db) {
                db.execSQL("CREATE TABLE records (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)");
            }
            @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
                throw new IllegalStateException("Unsupported local database version");
            }
        };
        database.setWriteAheadLoggingEnabled(true);
    }
    @PluginMethod public void get(PluginCall call) {
        worker.execute(() -> {
            try (var statement = database.getReadableDatabase().compileStatement("SELECT value FROM records WHERE key=?")) {
                JSObject result = new JSObject();
                statement.bindString(1, call.getString("key", ""));
                try { result.put("value", statement.simpleQueryForString()); }
                catch (android.database.sqlite.SQLiteDoneException missing) { result.put("value", JSObject.NULL); }
                call.resolve(result);
            } catch (Exception error) { call.reject("Не удалось прочитать локальные данные", error); }
        });
    }
    @PluginMethod public void scan(PluginCall call) {
        worker.execute(() -> {
            String prefix = call.getString("prefix", "");
            String after = call.getString("after", "");
            int limit = Math.max(1, Math.min(1000, call.getInt("limit", 250)));
            try (var cursor = database.getReadableDatabase().rawQuery(
                "SELECT key FROM records WHERE substr(key,1,?)=? AND key>? ORDER BY key LIMIT ?",
                new String[]{Integer.toString(prefix.length()), prefix, after, Integer.toString(limit)});
                var valueQuery = database.getReadableDatabase().compileStatement("SELECT value FROM records WHERE key=?")) {
                JSArray entries = new JSArray();
                long bytes = 0;
                while (cursor.moveToNext()) {
                    String key = cursor.getString(0);
                    valueQuery.bindString(1, key);
                    String value = valueQuery.simpleQueryForString();
                    if (entries.length() > 0 && bytes + value.length() > 1024 * 1024) break;
                    entries.put(new JSObject().put("key", key).put("value", value));
                    bytes += value.length();
                }
                call.resolve(new JSObject().put("entries", entries));
            } catch (Exception error) { call.reject("Не удалось прочитать локальный список", error); }
        });
    }
    @PluginMethod public void batch(PluginCall call) {
        worker.execute(() -> {
            try {
                SQLiteDatabase db = database.getWritableDatabase();
                db.beginTransaction();
                try {
                JSArray changes = call.getArray("changes", new JSArray());
                for (int i = 0; i < changes.length(); i++) {
                    var change = changes.getJSONObject(i);
                    String key = change.getString("key");
                    if (change.isNull("value")) db.delete("records", "key=?", new String[]{key});
                    else {
                        ContentValues row = new ContentValues();
                        row.put("key", key);
                        row.put("value", change.getString("value"));
                        if (db.insertWithOnConflict("records", null, row, SQLiteDatabase.CONFLICT_REPLACE) == -1) throw new IllegalStateException("Local insert failed");
                    }
                }
                db.setTransactionSuccessful();
                } finally { db.endTransaction(); }
                call.resolve();
            } catch (Exception error) { call.reject("Не удалось сохранить данные на устройстве", error); }
        });
    }
    @PluginMethod public void clear(PluginCall call) {
        worker.execute(() -> {
            try {
                String prefix = call.getString("prefix", "");
                database.getWritableDatabase().delete("records", "substr(key,1,?)=?", new String[]{Integer.toString(prefix.length()), prefix});
                call.resolve();
            } catch (Exception error) { call.reject("Не удалось очистить локальные данные", error); }
        });
    }
    @PluginMethod public void exit(PluginCall call) { getActivity().runOnUiThread(() -> { call.resolve(); getActivity().moveTaskToBack(true); }); }
    @PluginMethod public void saveFile(PluginCall call) {
        String name = call.getString("name", "dndshare-export");
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
            .setType(call.getString("mime", "application/octet-stream")).putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(call, intent, "fileDestination");
    }
    @ActivityCallback private void fileDestination(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) { call.resolve(new JSObject().put("cancelled", true)); return; }
        var destination = result.getData().getData();
        worker.execute(() -> {
            try (var output = getContext().getContentResolver().openOutputStream(destination)) {
                output.write(android.util.Base64.decode(call.getString("base64", ""), android.util.Base64.DEFAULT));
                call.resolve(new JSObject().put("cancelled", false));
            } catch (Exception error) { call.reject("Не удалось сохранить файл", error); }
        });
    }
    @PluginMethod public void print(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            PrintManager manager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
            manager.print("DnD Share", bridge.getWebView().createPrintDocumentAdapter("DnD Share"), null);
            call.resolve();
        });
    }
    @PluginMethod public void clearSession(PluginCall call) {
        getActivity().runOnUiThread(() -> CookieManager.getInstance().removeAllCookies(done -> {
            CookieManager.getInstance().flush();
            bridge.getWebView().clearCache(true);
            worker.execute(() -> { MediaCache.clear(getContext()); call.resolve(); });
        }));
    }
    @Override protected void handleOnDestroy() {
        worker.execute(() -> database.close());
        worker.shutdown();
    }
}
