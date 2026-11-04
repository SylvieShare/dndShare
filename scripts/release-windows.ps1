param(
    [ValidateSet('Release', 'Prepare', 'Publish', 'Rollback')]
    [string]$Mode = 'Release',
    [string]$Commit,
    [string[]]$BrowserFile = @(),
    [string]$BrowserExecutable,
    [int]$PreviewPort = 15441,
    [string]$GitBash = "${env:ProgramFiles}\Git\bin\bash.exe"
)
$ErrorActionPreference = 'Stop'

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program exited with code $LASTEXITCODE." }
}

function Assert-Clean {
    param([string]$Checkout)
    if (Invoke-Checked git @('-C', $Checkout, 'status', '--porcelain', '--untracked-files=all')) {
        throw "Release checkout has local changes: $Checkout"
    }
}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (!(Test-Path -LiteralPath $GitBash -PathType Leaf)) { throw 'Git for Windows Bash is required.' }
if ($Mode -eq 'Rollback') {
    Assert-Clean $root
    Push-Location $root
    try { Invoke-Checked $GitBash @('deploy/deploy.sh', '--rollback') }
    finally { Pop-Location }
    return
}
if (!$Commit) { throw 'Specify the commit to release.' }
if ($Mode -eq 'Release' -and !$BrowserFile.Count) {
    throw 'Choose a production BrowserFile, or use Prepare and Publish for a manual check.'
}
if ($Mode -eq 'Publish' -and $BrowserFile.Count) {
    throw 'Run browser checks with Prepare or Release.'
}

$sha = Invoke-Checked git @('-C', $root, 'rev-parse', '--verify', '--end-of-options', "$Commit^{commit}")
$gitDir = Invoke-Checked git @('-C', $root, 'rev-parse', '--path-format=absolute', '--git-common-dir')
$primary = Split-Path -Parent $gitDir
$worktree = Join-Path $primary 'build/ui-release/windows'
$lockPath = Join-Path $gitDir 'ui-locks/windows-release.lock'
New-Item -ItemType Directory -Force (Split-Path -Parent $lockPath) | Out-Null
try { $lock = [IO.File]::Open($lockPath, 'OpenOrCreate', 'ReadWrite', 'None') }
catch { throw "Another Windows release owns $lockPath" }

try {
    if ($Mode -ne 'Prepare') {
        Invoke-Checked git @('-C', $root, 'fetch', 'origin', 'main')
        Invoke-Checked git @('-C', $root, 'merge-base', '--is-ancestor', 'origin/main', $sha)
    }
    if ($Mode -eq 'Publish') {
        if (!(Test-Path -LiteralPath $worktree -PathType Container)) { throw 'Prepare the release first.' }
    } elseif (Test-Path -LiteralPath $worktree) {
        Assert-Clean $worktree
        Invoke-Checked git @('-C', $worktree, '-c', 'core.autocrlf=false', 'checkout', '--detach', $sha)
    } else {
        New-Item -ItemType Directory -Force (Split-Path -Parent $worktree) | Out-Null
        Invoke-Checked git @('-C', $root, '-c', 'core.autocrlf=false', 'worktree', 'add', '--detach', $worktree, $sha)
    }
    Assert-Clean $worktree
    if ((Invoke-Checked git @('-C', $worktree, 'rev-parse', 'HEAD')) -ne $sha) {
        throw 'The prepared checkout has a different commit.'
    }
    $frontend = Join-Path $worktree 'frontend'
    $receipt = Join-Path $primary "build/releases/$sha"
    New-Item -ItemType Directory -Force $receipt | Out-Null

    if ($Mode -ne 'Publish') {
        foreach ($file in $BrowserFile) {
            if ($file -notmatch '^tests/(?:[\w.-]+/)*[\w.-]+\.spec\.js$' -or
                $file.Split('/') -contains '..' -or !(Test-Path -LiteralPath (Join-Path $frontend $file) -PathType Leaf)) {
                throw "Use an existing frontend-relative browser spec: $file"
            }
        }
        $cacheStamp = Join-Path $frontend 'node_modules/.dndshare-package-lock'
        $lockHash = (Get-FileHash -LiteralPath (Join-Path $frontend 'package-lock.json')).Hash
        Push-Location $frontend
        try {
            if (!(Test-Path -LiteralPath $cacheStamp) -or
                (Get-Content -LiteralPath $cacheStamp) -ne $lockHash -or
                !(Test-Path -LiteralPath 'node_modules/.bin/vite')) {
                Invoke-Checked npm.cmd @('ci', '--no-audit', '--no-fund')
                Set-Content -LiteralPath $cacheStamp -Value $lockHash -Encoding ascii
            }
        } finally { Pop-Location }
        Push-Location $worktree
        try { Invoke-Checked $GitBash @('deploy/deploy.sh', '--prepare') }
        finally { Pop-Location }
        if ($BrowserFile.Count) {
            $vars = @{
                DNDSHARE_PREBUILT_FRONTEND = '1'
                DNDSHARE_BROWSER_BUILD_PORT = "$PreviewPort"
                DNDSHARE_BROWSER_REPORT = Join-Path $receipt 'browser-release.json'
                DNDSHARE_BROWSER_OUTPUT = Join-Path $receipt 'browser-release'
            }
            if ($BrowserExecutable) {
                $vars.DNDSHARE_BROWSER_EXECUTABLE = (Resolve-Path -LiteralPath $BrowserExecutable).Path
            }
            $saved = @{}
            Push-Location $frontend
            try {
                foreach ($key in $vars.Keys) {
                    $saved[$key] = [Environment]::GetEnvironmentVariable($key)
                    [Environment]::SetEnvironmentVariable($key, $vars[$key])
                }
                Invoke-Checked node (@('node_modules/playwright/cli.js', 'test', '-c', 'playwright.suite.config.js', '--project=production') + $BrowserFile)
            } finally {
                foreach ($key in $saved.Keys) { [Environment]::SetEnvironmentVariable($key, $saved[$key]) }
                Pop-Location
            }
        }
    }
    if ($Mode -eq 'Prepare') {
        Write-Host "Prepared $sha at $worktree. Use -Mode Publish -Commit $sha after checking it."
        return
    }
    # Check main again after testing, before sending anything to the VM.
    Invoke-Checked git @('-C', $root, 'fetch', 'origin', 'main')
    Invoke-Checked git @('-C', $root, 'merge-base', '--is-ancestor', 'origin/main', $sha)
    Push-Location $worktree
    try { Invoke-Checked $GitBash @('deploy/deploy.sh', '--publish') }
    finally { Pop-Location }
    $health = Invoke-RestMethod -Uri 'https://dndshare.ru/api/health' -TimeoutSec 15
    if ($health.status -ne 'ok' -or $health.commitSha -ne $sha) { throw 'Public readiness SHA mismatch.' }
    Assert-Clean $worktree
    @{
        commitSha = $sha
        source = $worktree
        releaseGitStatus = 'clean'
        bundleSha256 = (Get-FileHash -LiteralPath (Join-Path $worktree 'build/web-release/release.tar.gz')).Hash.ToLowerInvariant()
        readiness = $health
    } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $receipt 'web-release.json') -Encoding utf8
} finally {
    $lock.Dispose()
}
