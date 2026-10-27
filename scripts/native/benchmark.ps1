param([Parameter(Mandatory = $true)][string]$Serial)
$ErrorActionPreference = 'Stop'
$env:PATHEXT = [Environment]::GetEnvironmentVariable('PATHEXT', 'Machine')
$env:JAVA_HOME = [Environment]::GetEnvironmentVariable('JAVA_HOME', 'User')
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr' }
$env:ANDROID_HOME = [Environment]::GetEnvironmentVariable('ANDROID_HOME', 'User')
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$env:Path = (Join-Path $env:JAVA_HOME 'bin') + ';' + $env:Path
$adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
$isEmulator = & $adb -s $Serial shell getprop ro.kernel.qemu
if ($LASTEXITCODE -ne 0 -or "$isEmulator".Trim() -eq '1') { throw 'Performance measurements require an authorized physical device.' }
$previousSerial = $env:ANDROID_SERIAL
$env:ANDROID_SERIAL = $Serial
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\native'))
Push-Location -LiteralPath $project
try {
    $ErrorActionPreference = 'Continue'
    & (Join-Path $project 'gradlew.bat') --console=plain --no-daemon :macrobenchmark:connectedBenchmarkAndroidTest '-PapiBaseUrl=https://dndshare.ru'
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Pop-Location
    $env:ANDROID_SERIAL = $previousSerial
}
