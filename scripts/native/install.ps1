param(
    [string]$Serial,
    [string]$ReleaseManifest,
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

if ($ReleaseManifest) {
    $manifestFile = (Resolve-Path -LiteralPath $ReleaseManifest).Path
    $release = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json
    if ($release.commitSha -notmatch '^[a-f0-9]{40}$' -or
        $release.android.file -notmatch '^[\w.-]+\.apk$' -or
        $release.android.sha256 -notmatch '^[a-f0-9]{64}$') {
        throw 'The release manifest must identify a commit, a sibling APK and its SHA-256.'
    }
    $apkFile = Join-Path (Split-Path -Parent $manifestFile) $release.android.file
    if ((Get-FileHash -LiteralPath $apkFile -Algorithm SHA256).Hash -ne $release.android.sha256) {
        throw 'APK checksum does not match the release manifest.'
    }
    # Check the package before sending it to the device.
    $aapt = Get-ChildItem -LiteralPath (Join-Path $sdkDirectory 'build-tools') -Directory |
        Sort-Object Name -Descending |
        ForEach-Object { Join-Path $_.FullName 'aapt.exe' } |
        Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (!$aapt) { throw 'Android SDK build-tools are required to verify the prepared APK.' }
    $package = & $aapt dump badging $apkFile | Select-String '^package:'
    if ($LASTEXITCODE -ne 0 -or "$package" -notmatch "^package: name='ru\.dndshare\.client' ") {
        throw 'The prepared APK is not the DnD Share app.'
    }
    Write-Host "Installing verified APK from $($release.commitSha)"
} else {
    & (Join-Path $PSScriptRoot 'build.ps1') -Target Android
    if ($LASTEXITCODE -ne 0) { throw 'APK build failed.' }
    $apkFile = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\native\androidApp\build\outputs\apk\debug\androidApp-debug.apk'))
}

# -r updates in place. Signature conflicts fail without removing app data.
Invoke-NativeAdb -AdbArguments @('-s', $Serial, 'install', '-r', $apkFile) | Write-Host
if ($ReleaseManifest) {
    $paths = Invoke-NativeAdb -AdbArguments @('-s', $Serial, 'shell', 'pm', 'path', 'ru.dndshare.client')
    $installed = @($paths | Where-Object { $_ -match '^package:/\S+/base\.apk$' })
    if ($installed.Count -ne 1) { throw 'The installed DnD Share base APK was not found.' }
    $installed = $installed[0].Substring('package:'.Length)
    $hash = Invoke-NativeAdb -AdbArguments @('-s', $Serial, 'shell', 'sha256sum', $installed)
    if (($hash -split '\s+')[0] -ne $release.android.sha256) {
        throw 'The installed APK checksum does not match the prepared release.'
    }
}
if (-not $NoLaunch) {
    Invoke-NativeAdb -AdbArguments @('-s', $Serial, 'shell', 'am', 'start', '-W', '-n', 'ru.dndshare.client/.MainActivity') | Write-Host
}
Write-Host "DnD Share updated on $Serial"
