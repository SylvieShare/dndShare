$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'queue.ps1')
. (Join-Path $PSScriptRoot 'artifacts.ps1')
$testRoot=Join-Path ([IO.Path]::GetTempPath()) ('dndshare-artifact-test-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
$repo=Join-Path $testRoot 'repo';$source=$null;$passed=$false
try{
    New-Item -ItemType Directory -Path "$repo/frontend" -Force | Out-Null
    [IO.File]::WriteAllText("$repo/.node-version","24.22.3`n")
    [IO.File]::WriteAllText("$repo/.gitignore","build/`nfrontend/target/`n")
    [IO.File]::WriteAllText("$repo/frontend/package.json",'{}')
    & git -C $repo init -q
    & git -C $repo add -- .node-version .gitignore frontend/package.json
    & git -C $repo -c user.name=Fixture -c user.email=fixture@localhost commit -qm 'fixture'
    $sha=(& git -C $repo rev-parse HEAD).Trim()
    $directory=Join-Path $repo "build/releases/$sha"
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $counter=Join-Path $testRoot 'build-count.txt'
    $env:DNDSHARE_ARTIFACT_TEST_COUNTER=$counter
    $mock=Join-Path $testRoot 'build.ps1'
    $body=@'
if($args[0] -eq '-c'){exit 0}
$destination=$env:DNDSHARE_RELEASE_OUTPUT
if($destination -match '^/([a-z])/(.*)$'){$destination=$Matches[1]+':/'+$Matches[2]}
New-Item -ItemType Directory -Force "$destination","frontend/target/dist" | Out-Null
[IO.File]::AppendAllText($env:DNDSHARE_ARTIFACT_TEST_COUNTER,"build`n")
[IO.File]::WriteAllText("$destination/release.tar.gz",'immutable archive')
[IO.File]::WriteAllText((Join-Path (Get-Location) 'frontend/target/dist/index.html'),'<html>same source</html>')
[IO.File]::WriteAllText((Join-Path (Get-Location) 'frontend/target/dist/build-info.json'),'{"version":"1.0.0","build":1}')
exit 0
'@
    [IO.File]::WriteAllText($mock,$body)
    $first=Prepare-ReleaseArtifact $repo $directory $sha $mock
    $source=$first.sourceCheckout
    [IO.File]::WriteAllText("$source/frontend/target/dist/index.html",'mutable build output')
    $second=Prepare-ReleaseArtifact $repo $directory $sha $mock
    if(@(Get-Content -LiteralPath $counter).Count -ne 1){throw 'Same commit was rebuilt'}
    if((Get-Content -LiteralPath "$directory/frontend/index.html" -Raw) -ne '<html>same source</html>'){throw 'Snapshot followed mutable output'}
    [IO.File]::WriteAllText("$directory/frontend/index.html",'tampered')
    $rejected=$false
    try{$null=Assert-ReleaseArtifact $directory $sha}catch{$rejected=$true}
    if(!$rejected){throw 'A changed immutable resource was accepted'}
    Write-Host 'Artifact tests passed: one build per SHA, snapshot isolation and tamper rejection.'
    $passed=$true
}finally{
    $env:DNDSHARE_ARTIFACT_TEST_COUNTER=$null
    $resolved=[IO.Path]::GetFullPath($testRoot)
    $allowed=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if(!$resolved.StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase) -or !(Split-Path -Leaf $resolved).StartsWith('dndshare-artifact-test-')){throw 'Unsafe artifact test cleanup'}
    if($passed){
        if($source){& git -C $repo worktree unlock $source;& git -C $repo worktree remove --force $source}
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }else{Write-Host "Failed test evidence: $resolved"}
}
