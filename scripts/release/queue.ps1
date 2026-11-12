function Write-ReleaseJson {
    param([string]$Path, $Value)
    $temporary = "$Path.$([guid]::NewGuid().ToString('N')).tmp"
    [IO.File]::WriteAllText($temporary, ($Value | ConvertTo-Json -Depth 20), [Text.UTF8Encoding]::new($false))
    for ($attempt=0; $attempt -lt 20; $attempt++) {
        try {
            if(Test-Path -LiteralPath $Path){[IO.File]::Replace($temporary,$Path,[NullString]::Value)}else{[IO.File]::Move($temporary,$Path)}
            return
        }
        catch {
            if(($_.Exception -isnot [IO.IOException] -and $_.Exception.InnerException -isnot [IO.IOException]) -or $attempt -eq 19){throw}
            Start-Sleep -Milliseconds 50
        }
    }
}

function Convert-ReleaseJsonText {
    param([string]$Text)
    if($PSVersionTable.PSVersion.Major -ge 6){return ($Text|ConvertFrom-Json -AsHashtable)}
    Add-Type -AssemblyName System.Web.Extensions
    $serializer=New-Object System.Web.Script.Serialization.JavaScriptSerializer
    $serializer.MaxJsonLength=16777216
    return ,($serializer.DeserializeObject($Text))
}
function Read-ReleaseJson {
    param([string]$Path)
    for($attempt=0;$attempt -lt 20;$attempt++){
        $stream=$null;$reader=$null
        try{
            $stream=[IO.File]::Open($Path,'Open','Read',([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
            $reader=New-Object IO.StreamReader($stream,[Text.Encoding]::UTF8)
            return (Convert-ReleaseJsonText $reader.ReadToEnd())
        }catch{
            if($attempt -eq 19){throw}
            Start-Sleep -Milliseconds 50
        }finally{if($reader){$reader.Dispose()}elseif($stream){$stream.Dispose()}}
    }
}

function Add-ReleaseRequest {
    param([string]$QueueDirectory,[string]$Action,[string]$Commit,[string]$ArtifactDirectory)
    New-Item -ItemType Directory -Force -Path $QueueDirectory | Out-Null
    $id = [DateTime]::UtcNow.Ticks.ToString('D20')+'-'+[guid]::NewGuid().ToString('N')
    $job = @{schema=1;id=$id;action=$Action;commit=$Commit;artifact=$ArtifactDirectory;status='queued';attempts=0;createdUtc=[DateTime]::UtcNow.ToString('O')}
    $path = Join-Path $QueueDirectory "$id.json"
    Write-ReleaseJson -Path $path -Value $job
    return $path
}

function Invoke-ReleaseQueue {
    param([string]$QueueDirectory,[string]$LockPath,[string]$RequestPath,[scriptblock]$Operation,[int]$TimeoutSeconds=1800,[scriptblock]$Order)
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    $lastMessage = [DateTime]::MinValue
    while ([DateTime]::UtcNow -lt $deadline) {
        $own = Read-ReleaseJson $RequestPath
        if ($own.status -in @('published','superseded','rolledBack')) { return $own }
        if ($own.status -eq 'failed') { throw "Release request $($own.id) failed: $($own.error)" }
        $publisherLock = $null
        try { $publisherLock = [IO.File]::Open($LockPath,'OpenOrCreate','ReadWrite','None') }
        catch [IO.IOException] { }
        if ($publisherLock) {
            try {
                # A publishing state with no lock owner means its worker exited.
                # The operation reconciles the recorded target with server state.
                $pending = @(Get-ChildItem -LiteralPath $QueueDirectory -Filter '*.json' -File |
                    Sort-Object Name | ForEach-Object { @{path=$_.FullName;job=(Read-ReleaseJson $_.FullName)} } |
                    Where-Object {$_.job.status -in @('queued','publishing')})
                if($Order){$pending=@(& $Order $pending)}
                foreach ($entry in $pending) {
                    $job = $entry.job
                    $job.recovering = $job.status -eq 'publishing'
                    $job.status = 'publishing'
                    $job.attempts++
                    $job.workerPid = $PID
                    $job.startedUtc = [DateTime]::UtcNow.ToString('O')
                    Write-ReleaseJson $entry.path $job
                    try {
                        $outcome = & $Operation $job $entry.path
                        foreach ($key in $outcome.Keys) { $job[$key] = $outcome[$key] }
                        if ($job.status -notin @('published','superseded','rolledBack')) { throw 'Publication did not produce a final status.' }
                    } catch {
                        $job.status = 'failed'
                        $job.error = $_.Exception.Message
                    }
                    $job.finishedUtc = [DateTime]::UtcNow.ToString('O')
                    Write-ReleaseJson $entry.path $job
                }
            } finally { $publisherLock.Dispose() }
        } else { Start-Sleep -Milliseconds 500 }
        if (([DateTime]::UtcNow-$lastMessage).TotalSeconds -ge 5) {
            Write-Host "Publication queue: waiting for $($own.id)"
            $lastMessage = [DateTime]::UtcNow
        }
    }
    throw 'Publication wait timed out; the durable request remains in the queue.'
}
