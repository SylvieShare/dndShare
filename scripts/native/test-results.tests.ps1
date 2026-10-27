$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'test-results.ps1')
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('dndshare-test-results-' + [guid]::NewGuid())
[IO.Directory]::CreateDirectory($fixture) | Out-Null
$report = Join-Path $fixture 'TEST-fixture.xml'
function Write-Report([string]$Xml) { [IO.File]::WriteAllText($report, $Xml, (New-Object Text.UTF8Encoding($false))) }
function Expect-Rejection {
    $rejected = $false
    try { Assert-NativeInstrumentationResults -Directory $fixture | Out-Null } catch { $rejected = $true }
    if (-not $rejected) { throw 'Expected invalid instrumentation evidence to be rejected.' }
}
try {
    Expect-Rejection
    Write-Report '<testsuites tests="0" />'
    Expect-Rejection
    Write-Report '<testsuite><testcase><skipped /></testcase></testsuite>'
    Expect-Rejection
    Write-Report '<testsuite><testcase><failure>failed</failure></testcase></testsuite>'
    Expect-Rejection
    Write-Report '<testsuite><testcase><error>broken</error></testcase></testsuite>'
    Expect-Rejection
    Write-Report '<testsuite><testcase />'
    Expect-Rejection
    Write-Report '<testsuites tests="99"><testsuite><testcase name="one" /><testcase name="skip"><skipped /></testcase><testcase name="two" /></testsuite></testsuites>'
    $count = Assert-NativeInstrumentationResults -Directory $fixture
    if ($count -ne 2) { throw "Expected 2 executed cases, got $count." }
    Write-Host 'Native result validation: 7 cases passed.'
} finally { Remove-Item -LiteralPath $fixture -Recurse -Force }
