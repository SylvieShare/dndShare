param(
    [ValidateSet('Release','Prepare','Publish','Rollback')][string]$Mode='Release',
    [string]$Commit,
    [string[]]$BrowserFile=@(),
    [string]$BrowserExecutable,
    [int]$PreviewPort=0,
    [switch]$Android,
    [string]$GitBash="${env:ProgramFiles}\Git\bin\bash.exe"
)
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
. (Join-Path $PSScriptRoot 'node-environment.ps1')
. (Join-Path $PSScriptRoot 'release\queue.ps1')
. (Join-Path $PSScriptRoot 'release\artifacts.ps1')
. (Join-Path $PSScriptRoot 'release\publication.ps1')
Use-ProjectNode -RepositoryRoot $root
$env:GOTOOLCHAIN='auto'
if(!(Test-Path -LiteralPath $GitBash -PathType Leaf)){throw 'Git Bash is required'}
if($Mode -ne 'Rollback' -and !$Commit){throw 'Specify the commit to release'}
if($Mode -eq 'Release' -and !$BrowserFile.Count){throw 'Choose production browser specs, or use Prepare and Publish'}
if($Mode -eq 'Publish' -and $BrowserFile.Count){throw 'Run browser checks during preparation'}
if($Mode -eq 'Rollback' -and $Android){throw 'Android is built during preparation, not rollback'}
if($Mode -eq 'Rollback'){$Commit='HEAD'}
$sha=(& git -C $root rev-parse --verify --end-of-options "$Commit^{commit}").Trim()
if($LASTEXITCODE -ne 0 -or $sha -notmatch '^[0-9a-f]{40}$'){throw 'Invalid release commit'}
$gitDir=(& git -C $root rev-parse --path-format=absolute --git-common-dir).Trim()
$primary=Split-Path -Parent $gitDir
$directory=Join-Path $primary "build/releases/$sha"
if($PreviewPort -eq 0){
    $portProbe=New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback,0)
    $portProbe.Start();$PreviewPort=$portProbe.LocalEndpoint.Port;$portProbe.Stop()
}
$locks=Join-Path $gitDir 'ui-locks'
New-Item -ItemType Directory -Force -Path $locks,$directory | Out-Null
$buildLock=$null
try{
    $buildLockPath=Join-Path $locks "prepare-$sha.lock"
    while(!$buildLock){
        try{$buildLock=[IO.File]::Open($buildLockPath,'OpenOrCreate','ReadWrite','None')}
        catch [IO.IOException]{Write-Host "Waiting for the existing preparation of $sha";Start-Sleep -Milliseconds 500}
    }
    if($Mode -eq 'Rollback'){$controlSource=Get-ReleaseSource $root $directory $sha}
    elseif($Mode -eq 'Publish'){$manifest=Assert-ReleaseArtifact $directory $sha}
    else{
        $manifest=Prepare-ReleaseArtifact $root $directory $sha $GitBash
        Test-ReleaseFrontend $manifest $directory $BrowserFile $BrowserExecutable $PreviewPort
    }
    if($Android){
        . (Join-Path $PSScriptRoot 'release\android.ps1')
        $null=Build-ReleaseAndroid $manifest $directory
    }
}finally{if($buildLock){$buildLock.Dispose()}}
if($Mode -eq 'Prepare'){
    Write-Host "Prepared immutable artifact $sha at $directory"
    return
}
$queueDirectory=Join-Path $primary 'build/release-queue'
$action=$(if($Mode -eq 'Rollback'){'rollback'}else{'publish'})
$request=Add-ReleaseRequest $queueDirectory $action $sha $directory
Write-Host "Queued $action request $(Split-Path -Leaf $request)"
$workerSource=$(if($Mode -eq 'Rollback'){$controlSource}else{$manifest.sourceCheckout})
$workerArguments=@('-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+(Join-Path $workerSource 'scripts/release/worker.ps1')+'"'),
    '-RepositoryRoot',('"'+$workerSource+'"'),'-Primary',('"'+$primary+'"'),'-QueueDirectory',('"'+$queueDirectory+'"'),
    '-LockPath',('"'+(Join-Path $locks 'windows-release.lock')+'"'),'-RequestPath',('"'+$request+'"'),'-GitBash',('"'+$GitBash+'"'))
$requestId=[IO.Path]::GetFileNameWithoutExtension($request)
$workerStart=@{FilePath=(Get-Process -Id $PID).Path;ArgumentList=$workerArguments;WindowStyle='Hidden';PassThru=$true;
    RedirectStandardOutput=(Join-Path $queueDirectory "$requestId.worker.log");RedirectStandardError=(Join-Path $queueDirectory "$requestId.worker.err")}
$null=Start-Process @workerStart
$operation={param($job,$jobPath) Invoke-ReleaseOperation $job $jobPath $root $primary $GitBash}
$order={param($entries) Order-ReleaseRequests $entries $root}
$outcome=Invoke-ReleaseQueue $queueDirectory (Join-Path $locks 'windows-release.lock') $request $operation -Order $order
Write-ReleaseJson (Join-Path $directory ('publication-'+$outcome.id+'.json')) $outcome
Write-Host "$($outcome.status): $($outcome.actualCommit)"
