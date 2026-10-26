param(
    [string]$Serial,
    [switch]$NoLaunch,
    [switch]$ListDevices
)
$ErrorActionPreference = 'Stop'
$env:PATHEXT = [Environment]::GetEnvironmentVariable('PATHEXT', 'Machine')
$sdkDirectory = [Environment]::GetEnvironmentVariable('ANDROID_HOME', 'User')
if (-not $sdkDirectory) { $sdkDirectory = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$adbExecutable = Join-Path $sdkDirectory 'platform-tools\adb.exe'
if (-not (Test-Path -LiteralPath $adbExecutable)) { throw 'Android SDK platform-tools are required.' }

function Invoke-NativeAdb {
    param([string[]]$AdbArguments)
    $ErrorActionPreference = 'Continue'
    $adbOutput = @(& $adbExecutable @AdbArguments 2>&1)
    if ($LASTEXITCODE -ne 0) { throw ($adbOutput -join [Environment]::NewLine) }
    return $adbOutput
}

$deviceListing = @(Invoke-NativeAdb -AdbArguments @('devices', '-l'))
if ($ListDevices) { $deviceListing; return }
$devices = @($deviceListing | ForEach-Object {
    if ("$_" -match '^(\S+)\s+(device|unauthorized|offline)\b') {
        [PSCustomObject]@{ Serial = $Matches[1]; State = $Matches[2] }
    }
})
if ($Serial) {
    $selected = @($devices | Where-Object { $_.Serial -eq $Serial })
    if ($selected.Count -ne 1 -or $selected[0].State -ne 'device') {
        throw 'The selected device is unavailable. Unlock it and accept USB debugging on the phone.'
    }
} else {
    $selected = @($devices | Where-Object { $_.State -eq 'device' -and -not $_.Serial.StartsWith('emulator-') })
    if ($selected.Count -ne 1) {
        $deviceListing | Write-Host
        throw 'Connect one authorized phone, or choose a device with -Serial. Emulators are never selected automatically.'
    }
    $Serial = $selected[0].Serial
}

# Always build the current checkout against the production API.
& (Join-Path $PSScriptRoot 'build.ps1') -Target Android
if ($LASTEXITCODE -ne 0) { throw 'APK build failed.' }
$apkFile = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\native\androidApp\build\outputs\apk\debug\androidApp-debug.apk'))

# -r updates in place. Signature conflicts fail without removing app data.
Invoke-NativeAdb -AdbArguments @('-s', $Serial, 'install', '-r', $apkFile) | Write-Host
if (-not $NoLaunch) {
    Invoke-NativeAdb -AdbArguments @('-s', $Serial, 'shell', 'am', 'start', '-W', '-n', 'ru.dndshare.client/.MainActivity') | Write-Host
}
Write-Host "DnD Share updated on $Serial"
