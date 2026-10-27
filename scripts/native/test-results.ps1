function Assert-NativeInstrumentationResults {
    param([Parameter(Mandatory = $true)][string]$Directory)
    if (-not (Test-Path -LiteralPath $Directory)) { throw 'Instrumentation produced no result directory.' }
    $reports = @(Get-ChildItem -LiteralPath $Directory -Filter 'TEST*.xml' -File -Recurse)
    $executed = 0
    foreach ($report in $reports) {
        [xml]$document = Get-Content -LiteralPath $report.FullName -Raw -ErrorAction Stop
        if ($document.SelectNodes('//failure | //error').Count -gt 0) {
            throw "Instrumentation has failed cases: $($report.FullName)"
        }
        $executed += $document.SelectNodes('//testcase[not(skipped)]').Count
    }
    if ($executed -le 0) { throw 'Instrumentation executed zero tests. Gradle success alone is not a valid result.' }
    return $executed
}
