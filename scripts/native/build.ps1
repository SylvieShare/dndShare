param(
    [ValidateSet('Android', 'All', 'Test', 'DeviceTest')][string]$Target = 'All',
    [string]$ApiBaseUrl = 'https://dndshare.ru',
    [string]$DeviceSerial = 'emulator-5554',
    [string]$TestClass
)
$ErrorActionPreference = 'Stop'
# WSL may pass a reduced PATHEXT; use Windows' executable extensions locally.
$env:PATHEXT = [Environment]::GetEnvironmentVariable('PATHEXT', 'Machine')
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\native'))
$env:JAVA_HOME = [Environment]::GetEnvironmentVariable('JAVA_HOME', 'User')
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr' }
$env:ANDROID_HOME = [Environment]::GetEnvironmentVariable('ANDROID_HOME', 'User')
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$env:Path = (Join-Path $env:JAVA_HOME 'bin') + ';' + $env:Path
$previousSerial = $env:ANDROID_SERIAL
if ($Target -eq 'DeviceTest') {
    $adbExecutable = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
    $isEmulator = & $adbExecutable -s $DeviceSerial shell getprop ro.kernel.qemu
    if ($LASTEXITCODE -ne 0 -or "$isEmulator".Trim() -ne '1') {
        throw 'DeviceTest requires an emulator. Choose its serial with -DeviceSerial.'
    }
    $env:ANDROID_SERIAL = $DeviceSerial
    # Old XML must not turn a zero-test Gradle run into a passing result.
    $resultDirectory = Join-Path $project 'androidApp\build\outputs\androidTest-results\connected\debug'
    if (Test-Path -LiteralPath $resultDirectory) { Remove-Item -LiteralPath $resultDirectory -Recurse -Force }
}
[string[]]$nativeTasks = @(switch ($Target) {
    'Android' { @(':androidApp:assembleDebug') }
    'Test' { @(':androidApp:testDebugUnitTest') }
    'DeviceTest' { @(':androidApp:connectedDebugAndroidTest') }
    'All' { @(':androidApp:testDebugUnitTest', ':androidApp:lintDebug', ':androidApp:assembleDebug') }
})
$testArguments = @()
if ($TestClass) {
    if ($Target -ne 'DeviceTest' -or $TestClass -notmatch '^[A-Za-z0-9_.$#]+$') { throw 'TestClass requires DeviceTest and a qualified test name.' }
    $testArguments += "-Pandroid.testInstrumentationRunnerArguments.class=$TestClass"
}
Push-Location -LiteralPath $project
try {
    $ErrorActionPreference = 'Continue'
    & (Join-Path $project 'gradlew.bat') --console=plain --no-daemon @nativeTasks @testArguments "-PapiBaseUrl=$ApiBaseUrl"
    $code = $LASTEXITCODE
    if ($code -ne 0) { exit $code }
    if ($Target -eq 'DeviceTest') {
        . (Join-Path $PSScriptRoot 'test-results.ps1')
        $executed = Assert-NativeInstrumentationResults -Directory $resultDirectory
        Write-Host "Instrumented tests executed: $executed"
    }
} finally {
    Pop-Location
    $env:ANDROID_SERIAL = $previousSerial
}
