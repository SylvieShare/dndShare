param(
    [Parameter(Mandatory=$true)][Guid]$ThreadId,
    [Parameter(Mandatory=$true)][string]$ProjectDirectory,
    [Parameter(Mandatory=$true)][string]$TokenEnvFile,
    [string]$BaseUrl = 'https://dndshare.ru',
    [switch]$Start
)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath $ProjectDirectory).Path
$credentialFile = (Resolve-Path -LiteralPath $TokenEnvFile).Path
$workerRoot = Join-Path $env:LOCALAPPDATA 'dndshare\report-dispatch'
$stateRoot = Join-Path $workerRoot 'state'
New-Item -ItemType Directory -Force $stateRoot | Out-Null
$python = (Get-Command python.exe -ErrorAction Stop).Source
$pythonw = Join-Path (Split-Path -Parent $python) 'pythonw.exe'
if (!(Test-Path -LiteralPath $pythonw)) { throw 'Python with pythonw.exe is required.' }
$codex = (Get-Command codex.exe -ErrorAction Stop).Source
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$configFile = Join-Path $workerRoot 'config.json'
if (Test-Path -LiteralPath $configFile) {
    $previous = Get-Content -LiteralPath $configFile -Raw | ConvertFrom-Json
    if ($previous.threadId -ne "$ThreadId") { throw 'This computer already has a dispatcher bound to another chat.' }
}
foreach ($file in @('dispatcher.py','transport.py','state.py','auth_headers.py','configure_mcp.py')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination (Join-Path $workerRoot $file)
}
@{
    version=1; threadId="$ThreadId"; projectDirectory=$projectRoot; tokenEnvFile=$credentialFile;
    baseUrl=$BaseUrl; codexExecutable=$codex; codexHome=$codexHome; pythonExecutable=$python; stateDirectory=$stateRoot
} | ConvertTo-Json | Set-Content -LiteralPath $configFile -Encoding utf8

$codexConfig = Join-Path $codexHome 'config.toml'
& $python -X utf8 (Join-Path $workerRoot 'configure_mcp.py') --codex-config $codexConfig --dispatcher-config $configFile --helper (Join-Path $workerRoot 'auth_headers.py')
if ($LASTEXITCODE -ne 0) { throw 'Native report MCP configuration failed; dispatcher startup was not changed.' }

$workerScript = Join-Path $workerRoot 'dispatcher.py'
$workerArguments = '"' + $workerScript + '" --config "' + $configFile + '"'
$previousWorker = $null
$healthFile = Join-Path $stateRoot 'health.json'
if (Test-Path -LiteralPath $healthFile) {
    $workerHealth = Get-Content -LiteralPath $healthFile -Raw | ConvertFrom-Json
    $workerProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$workerHealth.pid)" -ErrorAction SilentlyContinue
    if ($workerProcess -and $workerProcess.ExecutablePath -eq $pythonw -and
        $workerProcess.CommandLine -match [regex]::Escape($workerScript) -and
        $workerProcess.CommandLine -match [regex]::Escape($configFile)) {
        $previousWorker = Get-Process -Id $workerProcess.ProcessId -ErrorAction SilentlyContinue
    }
}
$taskName = 'DnDShare-Report-Chat'
$startupMode = 'task'
try {
    $existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existing -and ($existing.Actions.Arguments -notcontains $workerArguments)) {
        throw 'A different task already uses the dispatcher task name.'
    }
    if ($existing -and $existing.State -eq 'Running') {
        Stop-ScheduledTask -TaskName $taskName
    }
    $action = New-ScheduledTaskAction -Execute $pythonw -Argument $workerArguments -WorkingDirectory $workerRoot
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User ([Security.Principal.WindowsIdentity]::GetCurrent().Name)
    $principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Deliver dndShare bug reports to one local Codex chat.' -Force | Out-Null
    if (!$Start) { Disable-ScheduledTask -TaskName $taskName | Out-Null }
} catch [System.UnauthorizedAccessException] {
    $startupMode = 'startup-shortcut'
} catch [Microsoft.Management.Infrastructure.CimException] {
    if ($_.Exception.NativeErrorCode -notin @(5,2)) { throw }
    $startupMode = 'startup-shortcut'
}
if ($previousWorker -and !$previousWorker.HasExited) {
    # Stop-ScheduledTask may return before its process releases the singleton lock.
    # This handle was verified against our executable, script and configuration.
    try { $previousWorker.Kill() }
    catch [System.InvalidOperationException] { if (!$previousWorker.HasExited) { throw } }
    if (!$previousWorker.WaitForExit(10000)) { throw 'The previous dispatcher has not exited; do not start a second worker.' }
}
if ($startupMode -eq 'startup-shortcut' -and $Start) {
    $shortcutFile = Join-Path ([Environment]::GetFolderPath('Startup')) 'DnDShare Report Chat.lnk'
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutFile)
    $shortcut.TargetPath=$pythonw; $shortcut.Arguments=$workerArguments; $shortcut.WorkingDirectory=$workerRoot
    $shortcut.WindowStyle=7; $shortcut.Description='Deliver dndShare bug reports to the local Codex chat.'
    $shortcut.Save()
}
@{threadId="$ThreadId"; configFile=$configFile; startupMode=$startupMode; taskName=$taskName} |
    ConvertTo-Json | Set-Content -LiteralPath (Join-Path $workerRoot 'installation.json') -Encoding utf8
if ($Start) {
    if ($startupMode -eq 'task') { Enable-ScheduledTask -TaskName $taskName | Out-Null; Start-ScheduledTask -TaskName $taskName }
    else { Start-Process -FilePath $pythonw -ArgumentList $workerArguments -WorkingDirectory $workerRoot -WindowStyle Hidden }
}
Write-Output "Dispatcher configuration: $configFile"
Write-Output "Startup mode: $startupMode"
Write-Output "Agent MCP server: dndshare_reports ($codexConfig)"
Write-Output 'Reload MCP connections in Codex settings to apply the configuration to existing chats.'
