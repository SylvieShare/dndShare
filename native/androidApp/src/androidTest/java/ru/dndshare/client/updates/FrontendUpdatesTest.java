package ru.dndshare.client.updates;

import android.content.Context;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import ru.dndshare.client.MainActivity;
import java.io.*;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class FrontendUpdatesTest {
    private Context target() { return InstrumentationRegistry.getInstrumentation().getTargetContext(); }
    private byte[] asset(String name) throws Exception { try(InputStream input=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("ota/"+name)) { return UpdateFiles.read(input,2*1024*1024); } }
    private UpdateRuntime runtime() throws Exception { return new UpdateRuntime(new JSONObject(new String(asset("runtime.json"),StandardCharsets.UTF_8))); }
    private File temporary(String name, byte[] bytes) throws Exception { File file=new File(target().getCacheDir(),name); UpdateFiles.atomic(file,bytes); return file; }
    private String evaluate(ActivityScenario<MainActivity> activity,String script) throws Exception {
        AtomicReference<String> result=new AtomicReference<>(); CountDownLatch done=new CountDownLatch(1);
        activity.onActivity(host->host.getBridge().getWebView().evaluateJavascript(script,value->{result.set(value);done.countDown();}));
        assertTrue(done.await(15,TimeUnit.SECONDS)); return result.get();
    }
    private void waitFor(ActivityScenario<MainActivity> activity,String script) throws Exception {
        long deadline=System.currentTimeMillis()+15000;
        while(System.currentTimeMillis()<deadline) {
            String error=evaluate(activity,"window.fixtureError||null");
            if(!"null".equals(error)) fail("Fixture JavaScript: "+error+" status="+evaluate(activity,"JSON.stringify(window.fixtureStatus||null)"));
            if("true".equals(evaluate(activity,script))) return; Thread.sleep(100);
        }
        fail("Condition failed: "+script+" body="+evaluate(activity,"JSON.stringify({body:document.body.innerText.slice(0,300),events:window.fixtureEvents,status:window.fixtureStatus})"));
    }
    private void stage(FrontendUpdates updater,String name) throws Exception {
        synchronized(updater) {
            UpdateManifest manifest=UpdateManifest.verify(asset(name+".json"),updater.runtime);
            updater.packages.install(manifest,temporary(name+".zip",asset(name+".zip")));
            updater.state.data.put("pending",manifest.id); updater.state.save();
        }
    }
    private void bind(ActivityScenario<MainActivity> activity,FrontendUpdates updater) {
        activity.onActivity(host->{ try {
            host.getFrontendUpdates().close();
            Field field=MainActivity.class.getDeclaredField("frontendUpdates"); field.setAccessible(true); field.set(host,updater);
            updater.attach(directory->{android.util.Log.i("OtaTest","reload="+directory);host.loadFrontendDirectory(directory);});
            String directory=updater.startup(); updater.foreground(); host.loadFrontendDirectory(directory);
            android.util.Log.i("OtaTest","start="+directory+" base="+host.getBridge().getLocalServer().getBasePath());
        } catch(Exception error) { throw new RuntimeException(error); } });
    }
    @Test public void signedFrontendLoadsKeepsSqliteAndRollsBackOnTimeoutAndProcessDeath() throws Exception {
        File root=new File(target().getFilesDir(),"updater-instrumentation");
        if(root.exists()) UpdateFiles.delete(target().getFilesDir(),root);
        try(var activity=ActivityScenario.launch(MainActivity.class)) {
            waitFor(activity,"!!window.Capacitor?.Plugins?.LocalStore && !!document.getElementById('app')?.__vue_app__");
            evaluate(activity,"window.updaterReady=false;window.Capacitor.Plugins.FrontendUpdater.getStatus().then(value=>window.updaterReady=value.ready)");
            waitFor(activity,"window.updaterReady===true");
            evaluate(activity,"window.kept=false;window.Capacitor.Plugins.LocalStore.batch({changes:[{key:'test:ota-kept',value:'42'}]}).then(()=>window.kept=true)");
            waitFor(activity,"window.kept===true");
            FrontendUpdates updater=new FrontendUpdates(runtime(),root,"process-a",10000,false);
            stage(updater,"good"); bind(activity,updater);
            waitFor(activity,"window.fixtureReady===true && !!document.getElementById('ota-good')");
            assertEquals(2,updater.status().getJSONObject("active").getLong("build"));
            evaluate(activity,"window.kept=false;window.Capacitor.Plugins.LocalStore.get({key:'test:ota-kept'}).then(value=>window.kept=value.value==='42')");
            waitFor(activity,"window.kept===true");
            stage(updater,"bad"); activity.onActivity(host->{try { updater.applyPending(updater.status().getString("bootToken")); } catch(Exception error){throw new RuntimeException(error);} });
            waitFor(activity,"!!document.getElementById('ota-bad')");
            waitFor(activity,"window.fixtureReady===true && !!document.getElementById('ota-good')");
            assertEquals("rolledBack",updater.status().getString("phase"));
            assertTrue(updater.state.failed(UpdateManifest.verify(asset("bad.json"),updater.runtime)));
            stage(updater,"crash"); activity.onActivity(host->{try { updater.applyPending(updater.status().getString("bootToken")); } catch(Exception error){throw new RuntimeException(error);} });
            updater.close();
            FrontendUpdates restarted=new FrontendUpdates(runtime(),root,"process-b",1000,false);
            bind(activity,restarted);
            waitFor(activity,"window.fixtureReady===true && !!document.getElementById('ota-good')");
            assertEquals(2,restarted.status().getJSONObject("active").getLong("build"));
            assertTrue(restarted.state.failed(UpdateManifest.verify(asset("crash.json"),restarted.runtime)));
            evaluate(activity,"window.Capacitor.Plugins.LocalStore.clear({prefix:'test:ota-'})");
            restarted.close();
        } finally { if(root.exists()) UpdateFiles.delete(target().getFilesDir(),root); }
    }
    @Test public void tamperingWrongNativeRuntimeAndUnsafeZipAreRejected() throws Exception {
        File root=new File(target().getCacheDir(),"updater-validation");
        if(root.exists()) UpdateFiles.delete(target().getCacheDir(),root);
        UpdateRuntime runtime=runtime(); UpdatePackages packages=new UpdatePackages(root,runtime);
        try {
            byte[] bytes=asset("good.zip"); bytes[bytes.length-1]^=1;
            UpdateManifest good=UpdateManifest.verify(asset("good.json"),runtime);
            assertThrows(SecurityException.class,()->packages.install(good,temporary("tampered.zip",bytes)));
            JSONObject wrapper=new JSONObject(new String(asset("good.json"),StandardCharsets.UTF_8));
            wrapper.put("payload",wrapper.getString("payload").substring(1));
            assertThrows(Exception.class,()->UpdateManifest.verify(wrapper.toString().getBytes(StandardCharsets.UTF_8),runtime));
            JSONObject changed=new JSONObject(new String(asset("runtime.json"),StandardCharsets.UTF_8));
            changed.getJSONObject("frontend").put("nativeRuntime","f".repeat(64));
            UpdatePackages incompatible=new UpdatePackages(new File(root,"incompatible"),new UpdateRuntime(changed));
            assertThrows(SecurityException.class,()->incompatible.install(good,temporary("good.zip",asset("good.zip"))));
            UpdateManifest unsafe=UpdateManifest.verify(asset("unsafe.json"),runtime);
            assertThrows(Exception.class,()->packages.install(unsafe,temporary("unsafe.zip",asset("unsafe.zip"))));
            assertFalse(new File(packages.bundles,"escaped.txt").exists());
        } finally { UpdateFiles.delete(target().getCacheDir(),root); }
    }
    @Test public void unwritableUpdateStorageKeepsTheBuiltinFrontendUsable() throws Exception {
        File blocked=new File(target().getCacheDir(),"updater-blocked-root");
        if(blocked.exists()) UpdateFiles.delete(target().getCacheDir(),blocked);
        try {
            try(FileOutputStream output=new FileOutputStream(blocked)) { output.write(1); }
            FrontendUpdates updater=new FrontendUpdates(runtime(),blocked,"storage-failure",1000,false);
            assertNull(updater.startup());
            JSONObject status=updater.status();
            assertEquals("builtin",status.getJSONObject("active").getString("bundleId"));
            updater.ready(status.getString("bootToken"),1,"e".repeat(64));
            assertTrue(updater.status().getBoolean("ready"));
            assertEquals("error",updater.status().getString("phase"));
            updater.close();
        } finally { UpdateFiles.delete(target().getCacheDir(),blocked); }
    }
}
