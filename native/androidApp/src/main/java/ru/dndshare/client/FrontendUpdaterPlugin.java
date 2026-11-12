package ru.dndshare.client;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name="FrontendUpdater")
public class FrontendUpdaterPlugin extends Plugin {
    @Override public void load() { updates().observe(() -> { try { notifyListeners("statusChanged",JSObject.fromJSONObject(updates().status())); } catch(Exception ignored) { } }); }
    private ru.dndshare.client.updates.FrontendUpdates updates() { return ((MainActivity)getActivity()).getFrontendUpdates(); }
    private void run(PluginCall call, Action action) {
        getActivity().runOnUiThread(() -> { try { action.run(); call.resolve(JSObject.fromJSONObject(updates().status())); } catch(Exception error) { call.reject(error.getMessage(),error); } });
    }
    private interface Action { void run() throws Exception; }
    @PluginMethod public void getStatus(PluginCall call) { run(call, () -> {}); }
    @PluginMethod public void ready(PluginCall call) { run(call, () -> updates().ready(call.getString("bootToken",""),call.getData().getLong("build"),call.getString("sourceHash",""))); }
    @PluginMethod public void check(PluginCall call) { run(call, () -> updates().check(true)); }
    @PluginMethod public void checkpoint(PluginCall call) { run(call, () -> updates().checkpoint(call.getString("bootToken",""),call.getBoolean("canReload",false))); }
    @PluginMethod public void apply(PluginCall call) { run(call, () -> updates().applyPending(call.getString("bootToken",""))); }
}
