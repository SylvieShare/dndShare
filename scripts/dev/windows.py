"""Windows user environment and emulator-only native commands."""
import base64
import json
from pathlib import Path
import re
import shutil

from .common import UIError, capture, linux_path, windows_path


def quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def powershell(executable, script, **kwargs):
    prefix = "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; $env:PATHEXT=[Environment]::GetEnvironmentVariable('PATHEXT','Machine'); "
    encoded = base64.b64encode((prefix + script).encode("utf-16le")).decode("ascii")
    return capture([executable, "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], **kwargs)


def discover():
    executable = shutil.which("powershell.exe")
    if not executable:
        raise UIError("Windows PowerShell is required (run this CLI in Linux/WSL on C:)")
    script = """
    $java=[Environment]::GetEnvironmentVariable('JAVA_HOME','User')
    if (!$java) { $java=Join-Path $env:ProgramFiles 'Android\\Android Studio\\jbr' }
    $sdk=[Environment]::GetEnvironmentVariable('ANDROID_HOME','User')
    if (!$sdk) { $sdk=[Environment]::GetEnvironmentVariable('ANDROID_SDK_ROOT','User') }
    if (!$sdk) { $sdk=Join-Path $env:LOCALAPPDATA 'Android\\Sdk' }
    @{java=$java;sdk=$sdk;profile=$env:USERPROFILE} | ConvertTo-Json -Compress
    """
    user = json.loads(powershell(executable, script))
    return {"powershell": executable, "java_home": user["java"],
            "android_home": user["sdk"], "gradle_home": user["profile"] + "\\.gradle"}


def select_emulator(devices, requested=None):
    if requested and not re.fullmatch(r"emulator-\d+", requested):
        raise UIError("Only emulator-<number> serials are allowed")
    ready = [line.split()[0] for line in devices.splitlines()
             if re.match(r"^emulator-\d+\s+device(?:\s|$)", line)]
    if requested:
        if requested not in ready:
            raise UIError(f"Emulator {requested} is not ready")
        return requested
    if len(ready) != 1:
        raise UIError("Choose --emulator from ready emulator serials: " + ", ".join(ready))
    return ready[0]


def probe(config, source, requested=None, require_device=True):
    sdk = linux_path(config["android_home"])
    java = linux_path(config["java_home"]) / "bin/java.exe"
    adb = sdk / "platform-tools/adb.exe"
    emulator = sdk / "emulator/emulator.exe"
    text = (source / "native/androidApp/build.gradle.kts").read_text()
    api = re.search(r"compileSdk\s*=\s*(\d+)", text).group(1)
    platforms = [path.parent for path in (sdk / "platforms").glob("*/source.properties")
                 if re.search(rf"^AndroidVersion.ApiLevel\s*=\s*{api}(?:\.0)?\s*$", path.read_text(), re.M)
                 and (path.parent / "android.jar").is_file()]
    if not platforms:
        raise UIError(f"Android SDK platform {api} is missing in {sdk}")
    versions = {"java": capture([java, "-version"]), "adb": capture([adb, "version"]),
                "emulator": capture([emulator, "-version"]), "sdk_api": api,
                "sdk_platforms": [path.name for path in platforms]}
    if not re.search(r'version "(?:17|2[1-9])\.', versions["java"]):
        raise UIError("JDK 17 or a supported newer JBR is required")
    if not require_device:
        return versions
    devices = capture([adb, "devices"])
    serial = select_emulator(devices, requested)
    if capture([adb, "-s", serial, "shell", "getprop", "ro.kernel.qemu"]) != "1":
        raise UIError("Selected device is not an emulator")
    if capture([adb, "-s", serial, "shell", "getprop", "sys.boot_completed"]) != "1":
        raise UIError("Emulator has not finished booting")
    return dict(versions, serial=serial)


def native_command(config, workspace, target, serial, api_port):
    if target not in {"All", "Test", "Android", "DeviceTest"}:
        raise UIError("Unknown native target")
    if (target == "DeviceTest" or serial) and not re.fullmatch(r"emulator-\d+", serial or ""):
        raise UIError("Native checks require an emulator serial")
    script = workspace / "scripts/native/build.ps1"
    # New workspace outputs plus disabled Gradle build cache force fresh checks.
    wrapper = """
param([string]$BuildScript,[string]$Target,[string]$Serial,[string]$Api)
$ErrorActionPreference='Stop'
$env:PATHEXT=[Environment]::GetEnvironmentVariable('PATHEXT','Machine')
$env:TEMP=Join-Path $env:LOCALAPPDATA 'Temp'
$env:TMP=$env:TEMP
$env:GRADLE_OPTS='-Dorg.gradle.caching=false -Dorg.gradle.daemon=false'
& $BuildScript -Target $Target -DeviceSerial $Serial -ApiBaseUrl $Api
exit $LASTEXITCODE
"""
    runner = workspace / "build/ui-native.ps1"
    runner.parent.mkdir(exist_ok=True)
    runner.write_text(wrapper.lstrip(), encoding="utf-8")
    return [config["powershell"], "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
            "-File", windows_path(runner), "-BuildScript", windows_path(script),
            "-Target", target, *(["-Serial", serial] if serial else []), "-Api", f"http://127.0.0.1:{api_port}"]
