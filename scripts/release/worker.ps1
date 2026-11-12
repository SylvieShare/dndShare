param([string]$RepositoryRoot,[string]$Primary,[string]$QueueDirectory,[string]$LockPath,[string]$RequestPath,[string]$GitBash)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'queue.ps1')
. (Join-Path $PSScriptRoot 'artifacts.ps1')
. (Join-Path $PSScriptRoot 'publication.ps1')
$operation={param($job,$path) Invoke-ReleaseOperation $job $path $RepositoryRoot $Primary $GitBash}
$order={param($entries) Order-ReleaseRequests $entries $RepositoryRoot}
$null=Invoke-ReleaseQueue $QueueDirectory $LockPath $RequestPath $operation -Order $order
