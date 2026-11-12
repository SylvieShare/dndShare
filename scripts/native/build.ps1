param(
    [ValidateSet('Android', 'All', 'Test', 'DeviceTest')][string]$Target = 'Android',
    [string]$DeviceSerial = 'emulator-5554',
    [string]$TestClass,
    [switch]$PreparedFrontend
)
$ErrorActionPreference = 'Stop'
# WSL may pass a reduced PATHEXT; use Windows' executable extensions locally.
$env:PATHEXT = [Environment]::GetEnvironmentVariable('PATHEXT', 'Machine')
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\native'))
. (Join-Path $PSScriptRoot '..\node-environment.ps1')
Use-ProjectNode -RepositoryRoot (Split-Path -Parent $project)
Use-ProjectJava -RepositoryRoot (Split-Path -Parent $project)
if ($PreparedFrontend) {
    if ($Target -ne 'Android') { throw 'PreparedFrontend is only available for an Android release build.' }
    $sourceRoot = Split-Path -Parent $project
    if (& git -C $sourceRoot status --porcelain) { throw 'A prepared frontend requires a clean release checkout.' }
    & node (Join-Path $sourceRoot 'scripts\release\versions.mjs') --check
    if ($LASTEXITCODE -ne 0) { throw 'Component versions do not match the release source.' }
    $built = Get-Content -LiteralPath (Join-Path $sourceRoot 'frontend\target\dist\build-info.json') -Raw | ConvertFrom-Json
    if ($built.commitSha -ne (& git -C $sourceRoot rev-parse HEAD)) { throw 'Prepare the frontend from this exact commit first.' }
}
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
if ($PreparedFrontend) { $nativeTasks += @('-x', ':androidApp:bundleWeb') }
$testArguments = @()
if ($TestClass) {
    if ($Target -ne 'DeviceTest' -or $TestClass -notmatch '^[A-Za-z0-9_.$#]+$') { throw 'TestClass requires DeviceTest and a qualified test name.' }
    $testArguments += "-Pandroid.testInstrumentationRunnerArguments.class=$TestClass"
}
Push-Location -LiteralPath $project
try {
    $ErrorActionPreference = 'Continue'
    & (Join-Path $project 'gradlew.bat') --console=plain --no-daemon @nativeTasks @testArguments
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
