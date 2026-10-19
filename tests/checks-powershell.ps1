# Native PowerShell launcher contract acceptance; no Git/Docker install required.
# Run in Windows PowerShell 5.1 (and optionally PowerShell 7).
$ErrorActionPreference = 'Stop'
$Launcher = Join-Path $PSScriptRoot '../scripts/checks.ps1'
$Tokens = $null
$ParseErrors = $null
$Ast = [System.Management.Automation.Language.Parser]::ParseFile($Launcher, [ref]$Tokens, [ref]$ParseErrors)
if ($ParseErrors.Count) { throw ($ParseErrors | Out-String) }
foreach ($Name in @('Quote-Native', 'Run-Process', 'Git-Bytes')) {
    $Functions = @($Ast.FindAll({ param($Node) $Node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $Node.Name -eq $Name }, $true))
    if ($Functions.Count -ne 1) { throw "Expected exactly one launcher function: $Name" }
    Invoke-Expression $Functions[0].Extent.Text
}
$Root = Join-Path ([System.IO.Path]::GetTempPath()) ('moneybuddy argv ' + [guid]::NewGuid().ToString('N'))
[void][System.IO.Directory]::CreateDirectory($Root)
$OldPath = $env:PATH
$OldCapture = $env:MB_ARGV_CAPTURE
try {
    # A real native executable observes the argv produced by Windows/.NET rather
    # than duplicating the launcher's quoting algorithm in the test.
    $Exe = Join-Path $Root 'git.exe'
    Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
public static class MoneyBuddyArgvProbe {
    public static int Main(string[] args) {
        if (args.Length == 1 && args[0] == "--exit") return 17;
        if (args.Length == 1 && args[0] == "--inventory") {
            byte[] bytes = Encoding.UTF8.GetBytes("space name\0caf\u00e9 #.txt\0");
            Stream output = Console.OpenStandardOutput();
            output.Write(bytes, 0, bytes.Length);
            return 0;
        }
        using (BinaryWriter writer = new BinaryWriter(File.Create(Environment.GetEnvironmentVariable("MB_ARGV_CAPTURE")), Encoding.UTF8)) {
            writer.Write(args.Length);
            foreach (string arg in args) writer.Write(arg);
        }
        return 0;
    }
}
'@ -OutputAssembly $Exe -OutputType ConsoleApplication
    $env:PATH = $Root + [System.IO.Path]::PathSeparator + $OldPath
    $env:MB_ARGV_CAPTURE = Join-Path $Root 'arguments.bin'
    $Unicode = 'caf' + [char]0x00e9 + ' ' + [char]0x96ea
    $Expected = @('', 'plain', 'with spaces #', $Unicode, '"quoted"', '{"path":"C:\PM projects\","name":"quoted \"value\""}', 'C:\trailing\', 'space trailing\', 'backslashes\\"quote', "line one`nline two", '--committed')
    $Exit = Run-Process $Exe $Expected
    if ($Exit -ne 0) { throw "argv probe failed: $Exit" }
    $Reader = New-Object System.IO.BinaryReader([System.IO.File]::OpenRead($env:MB_ARGV_CAPTURE), [System.Text.Encoding]::UTF8)
    try {
        $Count = $Reader.ReadInt32()
        if ($Count -ne $Expected.Count) { throw "Argument count changed: $Count vs $($Expected.Count)" }
        for ($Index = 0; $Index -lt $Count; $Index++) {
            $Actual = $Reader.ReadString()
            if ($Actual -cne $Expected[$Index]) { throw "Argument $Index changed: [$Actual] vs [$($Expected[$Index])]" }
        }
    } finally { $Reader.Dispose() }
    if ((Run-Process $Exe @('--exit')) -ne 17) { throw 'Native exit code was lost' }
    $Inventory = Join-Path $Root 'inventory.bin'
    Git-Bytes @('--inventory') $Inventory
    $ExpectedBytes = [System.Text.Encoding]::UTF8.GetBytes("space name`0caf$([char]0x00e9) #.txt`0")
    $ActualBytes = [System.IO.File]::ReadAllBytes($Inventory)
    if ([Convert]::ToBase64String($ActualBytes) -cne [Convert]::ToBase64String($ExpectedBytes)) { throw 'NUL inventory bytes changed' }
    $Rejected = $false
    try { Git-Bytes @('--exit') (Join-Path $Root 'failed-inventory.bin') }
    catch {
        if ($_.Exception.Message -notmatch 'git exited 17') { throw }
        $Rejected = $true
    }
    if (-not $Rejected) { throw 'Failed Git inventory was accepted' }
    Write-Host "PASS: PowerShell $($PSVersionTable.PSVersion) launcher native argv, exit code, and UTF-8/NUL inventory contracts"
} finally {
    $env:PATH = $OldPath
    $env:MB_ARGV_CAPTURE = $OldCapture
    Remove-Item -LiteralPath $Root -Recurse -Force
}
