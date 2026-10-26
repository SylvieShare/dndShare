param(
    [ValidateSet('Android', 'Windows', 'All', 'Test')][string]$Target = 'All',
    [string]$ApiBaseUrl = 'https://dndshare.ru'
)
$ErrorActionPreference = 'Stop'
# WSL may pass a reduced PATHEXT; use Windows' executable extensions locally.
$env:PATHEXT = [Environment]::GetEnvironmentVariable('PATHEXT', 'Machine')
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\native'))
$env:JAVA_HOME = [Environment]::GetEnvironmentVariable('JAVA_HOME', 'User')
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr' }
$env:ANDROID_HOME = [Environment]::GetEnvironmentVariable('ANDROID_HOME', 'User')
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not $env:JPACKAGE_HOME) { $env:JPACKAGE_HOME = 'C:\Program Files\Java\jdk-17' }
if ($Target -in @('Windows', 'All') -and -not (Test-Path (Join-Path $env:JPACKAGE_HOME 'bin\jpackage.exe'))) {
    throw 'Set JPACKAGE_HOME to a full JDK 17+ installation containing jpackage.exe.'
}
$env:Path = (Join-Path $env:JAVA_HOME 'bin') + ';' + $env:Path
[string[]]$nativeTasks = @(switch ($Target) {
    'Android' { @(':androidApp:assembleDebug') }
    'Windows' { @(':desktopApp:packagePortableWindows') }
    'Test' { @(':shared:desktopTest') }
    'All' { @(':shared:desktopTest', ':androidApp:assembleDebug', ':desktopApp:packagePortableWindows') }
})
Push-Location -LiteralPath $project
try {
    $ErrorActionPreference = 'Continue'
    & (Join-Path $project 'gradlew.bat') --console=plain @nativeTasks "-PapiBaseUrl=$ApiBaseUrl"
    $code = $LASTEXITCODE
    if ($code -ne 0) { exit $code }
} finally { Pop-Location }
