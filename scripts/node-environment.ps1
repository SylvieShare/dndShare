function Use-ProjectNode {
    param([Parameter(Mandatory=$true)][string]$RepositoryRoot)
    $projectNodeVersion = (Get-Content -LiteralPath (Join-Path $RepositoryRoot '.node-version') -Raw).Trim()
    $projectNodeDirectory = Join-Path 'C:\Tools\NodeJS' "node-v$projectNodeVersion-win-x64"
    $projectNodeExecutable = Join-Path $projectNodeDirectory 'node.exe'
    if (!(Test-Path -LiteralPath $projectNodeExecutable)) { throw "Install Node $projectNodeVersion in $projectNodeDirectory (see README)." }
    if ((& $projectNodeExecutable --version).Trim() -ne "v$projectNodeVersion") { throw 'Project Node version does not match .node-version.' }
    $env:Path = $projectNodeDirectory + ';' + $env:Path
}

function Use-ProjectJava {
    param([Parameter(Mandatory=$true)][string]$RepositoryRoot)
    $projectJavaVersion = (Get-Content -LiteralPath (Join-Path $RepositoryRoot 'native\.java-version') -Raw).Trim()
    $projectJavaDirectory = Get-ChildItem -LiteralPath 'C:\Tools\Java' -Directory |
        Where-Object { $_.Name.StartsWith("jdk-$projectJavaVersion+") -and (Test-Path -LiteralPath (Join-Path $_.FullName 'bin\java.exe')) } |
        Sort-Object Name -Descending | Select-Object -First 1
    if (!$projectJavaDirectory) { throw "Install JDK $projectJavaVersion in C:\Tools\Java (see native/README.md)." }
    $env:JAVA_HOME = $projectJavaDirectory.FullName
    $env:Path = (Join-Path $env:JAVA_HOME 'bin') + ';' + $env:Path
}
