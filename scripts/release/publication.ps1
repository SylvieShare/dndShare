function Test-ReleaseAncestor {
    param([string]$RepositoryRoot,[string]$Ancestor,[string]$Descendant)
    & git -C $RepositoryRoot merge-base --is-ancestor $Ancestor $Descendant 2>$null
    return $LASTEXITCODE -eq 0
}
function Order-ReleaseRequests {
    param($Entries,[string]$RepositoryRoot)
    # Reconcile interrupted effects before sending anything else. Within each
    # publication batch, deploy the newest ready main commit first; older jobs
    # then become superseded. Rollback is an ordering barrier.
    $result=@($Entries|Where-Object {$_.job.status -eq 'publishing'})
    $batch=@()
    foreach($entry in @($Entries|Where-Object {$_.job.status -ne 'publishing'})){
        if($entry.job.action -eq 'rollback'){
            $result+=@($batch|Sort-Object depth -Descending);$batch=@();$result+= $entry
        }else{
            $depth=0
            if($entry.job.commit -match '^[0-9a-f]{40}$'){
                $count=& git -C $RepositoryRoot rev-list --count $entry.job.commit 2>$null
                if($LASTEXITCODE -eq 0){$depth=[int]$count}
            }
            $entry.depth=$depth;$batch+=$entry
        }
    }
    $result+=@($batch|Sort-Object depth -Descending)
    return $result
}
function Get-ReleaseServerState {
    param([string]$Source,[string]$GitBash)
    Push-Location $Source
    try{
        $raw=& $GitBash deploy/deploy.sh --state
        if($LASTEXITCODE -ne 0){throw 'Cannot read the remote deployment state'}
        return (Convert-ReleaseJsonText ($raw -join "`n"))
    }finally{Pop-Location}
}
function Invoke-ReleaseOperation {
    param($Job,[string]$JobPath,[string]$RepositoryRoot,[string]$Primary,[string]$GitBash)
    if($Job.schema -ne 1 -or $Job.action -notin @('publish','rollback') -or $Job.commit -notmatch '^[0-9a-f]{40}$'){throw 'Invalid publication request'}
    $directory=Join-Path $Primary "build/releases/$($Job.commit)"
    if([IO.Path]::GetFullPath($Job.artifact) -ne [IO.Path]::GetFullPath($directory)){throw 'Publication artifact escapes the repository release directory'}
    if($Job.action -eq 'publish'){
        $manifest=Assert-ReleaseArtifact $directory $Job.commit
        $source=$manifest.sourceCheckout
    }else{$source=Get-ReleaseSource $RepositoryRoot $directory $Job.commit}
    Invoke-ReleaseCommand git @('-C',$RepositoryRoot,'fetch','origin','main')
    $remote=Get-ReleaseServerState $source $GitBash
    if($Job.action -eq 'publish'){
        if(!(Test-ReleaseAncestor $RepositoryRoot $Job.commit 'origin/main')){throw 'Publication commit must belong to origin/main'}
        if($remote.activeCommit -and $remote.activeCommit -ne $Job.commit){
            if(Test-ReleaseAncestor $RepositoryRoot $Job.commit $remote.activeCommit){return @{status='superseded';actualCommit=$remote.activeCommit}}
            if(!(Test-ReleaseAncestor $RepositoryRoot $remote.activeCommit $Job.commit)){throw 'The active server is on a divergent history'}
        }
    }
    if($Job.recovering -and $Job.expectedTarget){
        if($remote.activeCommit -eq $Job.expectedTarget){return @{status=$(if($Job.action -eq 'rollback'){'rolledBack'}else{'published'});actualCommit=$remote.activeCommit;recovered=$true}}
        if($remote.activeCommit -ne $Job.expectedBefore){throw 'Server changed after the previous worker exited; request was preserved without replaying it'}
    }
    if($Job.action -eq 'rollback' -and !$remote.previousCommit){throw 'There is no previous managed release'}
    $Job.expectedBefore=$remote.activeCommit
    $Job.expectedTarget=$(if($Job.action -eq 'rollback'){$remote.previousCommit}else{$Job.commit})
    Write-ReleaseJson $JobPath $Job
    Set-ReleaseArtifactEnvironment $directory
    Push-Location $source
    try{
        if($Job.action -eq 'publish'){Invoke-ReleaseCommand $GitBash @('deploy/deploy.sh','--publish')}
        else{Invoke-ReleaseCommand $GitBash @('deploy/deploy.sh','--rollback',$Job.expectedBefore,$Job.expectedTarget)}
    }finally{Pop-Location}
    $health=Invoke-RestMethod -Uri https://dndshare.ru/api/health -TimeoutSec 15
    if($health.status -ne 'ok' -or $health.commitSha -ne $Job.expectedTarget){throw 'Public health did not confirm the activated release'}
    return @{status=$(if($Job.action -eq 'rollback'){'rolledBack'}else{'published'});actualCommit=$health.commitSha;health=$health}
}
