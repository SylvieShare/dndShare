$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'queue.ps1')
. (Join-Path $PSScriptRoot 'publication.ps1')
$testRoot=Join-Path ([IO.Path]::GetTempPath()) ('dndshare-queue-test-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
$passed=$false
function Assert-QueueTest($Condition,[string]$Message){if(!$Condition){throw $Message}}
try{
    $repository=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
    $newer=(& git -C $repository rev-parse HEAD).Trim()
    $older=(& git -C $repository rev-parse HEAD^).Trim()
    $entries=@(@{job=@{status='queued';action='publish';commit=$older}},@{job=@{status='queued';action='publish';commit=$newer}},
               @{job=@{status='queued';action='rollback';commit=$newer}},@{job=@{status='queued';action='publish';commit=$older}})
    $ordered=@(Order-ReleaseRequests $entries $repository)
    Assert-QueueTest ($ordered[0].job.commit -eq $newer -and $ordered[1].job.commit -eq $older -and $ordered[2].job.action -eq 'rollback') 'Newest-ready selection crossed a rollback barrier'
    $queue=Join-Path $testRoot 'queue'
    $lock=Join-Path $testRoot 'publisher.lock'
    $first=Add-ReleaseRequest $queue 'publish' ('a'*40) $testRoot
    $second=Add-ReleaseRequest $queue 'publish' ('b'*40) $testRoot
    $callback={param($job,$path) if($job.commit -eq ('a'*40)){throw 'expected failure'};return @{status='published';actualCommit=$job.commit}}
    $result=Invoke-ReleaseQueue $queue $lock $second $callback 10
    Assert-QueueTest ($result.status -eq 'published') 'A failed request blocked later publications'
    Assert-QueueTest ((Read-ReleaseJson $first).status -eq 'failed') 'Failure evidence was lost'

    $recovered=Add-ReleaseRequest $queue 'publish' ('c'*40) $testRoot
    $stale=Read-ReleaseJson $recovered;$stale.status='publishing';Write-ReleaseJson $recovered $stale
    $recoveryCallback={param($job,$path) if(!$job.recovering){throw 'stale publisher was not detected'};return @{status='published';actualCommit=$job.commit;recovered=$true}}
    $result=Invoke-ReleaseQueue $queue $lock $recovered $recoveryCallback 10
    Assert-QueueTest $result.recovered 'Interrupted publication was not reconciled'

    $child=Join-Path $testRoot 'client.ps1'
    $module=(Join-Path $PSScriptRoot 'queue.ps1').Replace("'","''")
    $text=@'
param([string]$TestRoot,[string]$Module)
$ErrorActionPreference='Stop'
. $Module
$queue=Join-Path $TestRoot 'parallel'
$lock=Join-Path $TestRoot 'parallel.lock'
$request=Add-ReleaseRequest $queue 'publish' ('d'*40) $TestRoot
$operation={param($job,$path)
  $guard=[IO.File]::Open((Join-Path $TestRoot 'operation.lock'),'OpenOrCreate','ReadWrite','None')
  try{Start-Sleep -Milliseconds 100;[IO.File]::AppendAllText((Join-Path $TestRoot 'executed.txt'),$job.id+"`n")}
  finally{$guard.Dispose()}
  return @{status='published';actualCommit=$job.commit}
}
$result=Invoke-ReleaseQueue $queue $lock $request $operation 30
if($result.status -ne 'published'){throw 'publication failed'}
[IO.File]::WriteAllText((Join-Path $TestRoot ('success-'+$PID+'.txt')),$result.id)
'@
    [IO.File]::WriteAllText($child,$text)
    $processes=@()
    $shell=(Get-Process -Id $PID).Path
    foreach($index in 1..4){
        $arguments=@('-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$child`"",'-TestRoot',"`"$testRoot`"",'-Module',"`"$module`"")
        $processes+=Start-Process -FilePath $shell -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $testRoot "child-$index.log") -RedirectStandardError (Join-Path $testRoot "child-$index.err")
    }
    foreach($process in $processes){$null=$process.Handle;$process.WaitForExit();$process.Refresh()}
    $deadline=[DateTime]::UtcNow.AddSeconds(30)
    while(@(Get-ChildItem -LiteralPath $testRoot -Filter 'success-*.txt').Count -ne 4 -and [DateTime]::UtcNow -lt $deadline){Start-Sleep -Milliseconds 100}
    foreach($process in $processes){
        if($null -ne $process.ExitCode -and $process.ExitCode -ne 0){
            $errors=(Get-ChildItem -LiteralPath $testRoot -Filter 'child-*.err'|ForEach-Object{Get-Content -LiteralPath $_.FullName -Raw}) -join "`n"
            throw "Concurrent worker failed: $($process.Id), exit=$($process.ExitCode). $errors"
        }
    }
    Assert-QueueTest (@(Get-ChildItem -LiteralPath $testRoot -Filter 'success-*.txt').Count -eq 4) 'A client did not receive its final result'
    $lines=@(Get-Content -LiteralPath (Join-Path $testRoot 'executed.txt'))
    Assert-QueueTest ($lines.Count -eq 4 -and @($lines|Sort-Object -Unique).Count -eq 4) 'Requests were lost or published twice'
    Write-Host 'Queue tests passed: serialization, independent failures and worker recovery.'
    $passed=$true
}finally{
    $resolved=[IO.Path]::GetFullPath($testRoot)
    $allowed=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if(!$resolved.StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase) -or !(Split-Path -Leaf $resolved).StartsWith('dndshare-queue-test-')){throw 'Unsafe test cleanup target'}
    if($passed){Remove-Item -LiteralPath $resolved -Recurse -Force}else{Write-Host "Failed test evidence: $resolved"}
}
