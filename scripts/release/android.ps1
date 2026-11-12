function Build-ReleaseAndroid {
    param($Manifest,[string]$Directory)
    $androidDirectory=Join-Path $Directory 'android'
    $receiptPath=Join-Path $androidDirectory 'release.json'
    if(Test-Path -LiteralPath $receiptPath){
        $receipt=Read-ReleaseJson $receiptPath
        if($receipt.commitSha -ne $Manifest.commitSha -or (Get-FileHash -LiteralPath (Join-Path $androidDirectory $receipt.android.file)).Hash.ToLowerInvariant() -ne $receipt.android.sha256){throw 'Prepared Android artifact changed'}
        return $receipt
    }
    $source=$Manifest.sourceCheckout
    & (Join-Path $source 'scripts\native\build.ps1') -Target Android -PreparedFrontend
    if($LASTEXITCODE -ne 0){throw 'Prepared Android build failed'}
    $apk=Join-Path $source 'native\androidApp\build\outputs\apk\debug\androidApp-debug.apk'
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive=[IO.Compression.ZipFile]::OpenRead($apk)
    $expected=@{}
    foreach($name in $Manifest.frontendFiles.Keys){if($name -notmatch '^\.vite/' -and $name -notmatch '\.(gz|br)$'){$expected[$name]=$Manifest.frontendFiles[$name]}}
    $seen=0
    try{
        foreach($entry in $archive.Entries){
            if(!$entry.FullName.StartsWith('assets/public/') -or $entry.FullName.EndsWith('/')){continue}
            $name=$entry.FullName.Substring('assets/public/'.Length)
            if(!$expected.ContainsKey($name)){throw "Unexpected APK web resource: $name"}
            $stream=$entry.Open()
            try{$sha=[Security.Cryptography.SHA256]::Create();$digest=[BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','').ToLowerInvariant()}
            finally{$stream.Dispose();if($sha){$sha.Dispose()}}
            if($digest -ne $expected[$name]){throw "APK differs from immutable frontend: $name"}
            $seen++
        }
    }finally{$archive.Dispose()}
    if($seen -ne $expected.Count){throw 'APK frontend is incomplete'}
    New-Item -ItemType Directory -Force -Path $androidDirectory | Out-Null
    Copy-Item -LiteralPath $apk -Destination (Join-Path $androidDirectory 'dndshare.apk')
    $receipt=@{commitSha=$Manifest.commitSha;sourceCheckout=$source;frontendFilesVerified=$seen;
        android=@{file='dndshare.apk';sha256=(Get-FileHash -LiteralPath $apk).Hash.ToLowerInvariant()}}
    Write-ReleaseJson $receiptPath $receipt
    return $receipt
}
