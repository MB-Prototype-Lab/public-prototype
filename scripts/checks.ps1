# Host bootstrap for Windows PowerShell 5.1 and PowerShell 7. Git and Docker only.
param(
    [Parameter(Position=0)][string]$Command = 'all',
    [Parameter(ValueFromRemainingArguments=$true)][string[]]$CommandArgs = @()
)
$ErrorActionPreference = 'Stop'
$CleanupTag = $null
function Blocked([string]$Message) { Write-Host "BLOCKED  $Message"; exit 2 }
function Native([string]$Program, [string[]]$Arguments) {
    $Code = Run-Process $Program $Arguments
    if ($Code -ne 0) { throw "$Program exited $Code" }
}
# PowerShell 5.1 redirects native stdout through text encoding. Preserve NUL
# inventories with a byte stream instead; never interpolate filenames as code.
function Quote-Native([string]$Value) {
    return '"' + [regex]::Replace([regex]::Replace($Value, '(\\*)"', '$1$1\"'), '(\\+)$', '$1$1') + '"'
}
function Run-Process([string]$Program, [string[]]$Arguments) {
    $Start = New-Object System.Diagnostics.ProcessStartInfo
    $Start.FileName = (Get-Command $Program).Source
    $Start.Arguments = ($Arguments | ForEach-Object { Quote-Native $_ }) -join ' '
    $Start.WorkingDirectory = $Root
    $Start.UseShellExecute = $false
    $Process = [System.Diagnostics.Process]::Start($Start)
    $Process.WaitForExit()
    $Code = $Process.ExitCode
    $Process.Dispose()
    return $Code
}
function Git-Bytes([string[]]$Arguments, [string]$Destination) {
    $Start = New-Object System.Diagnostics.ProcessStartInfo
    $Start.FileName = (Get-Command git).Source
    $Start.Arguments = ($Arguments | ForEach-Object { Quote-Native $_ }) -join ' '
    $Start.WorkingDirectory = $Root
    $Start.UseShellExecute = $false
    $Start.RedirectStandardOutput = $true
    $Start.RedirectStandardError = $true
    $Process = New-Object System.Diagnostics.Process
    $Process.StartInfo = $Start
    [void]$Process.Start()
    $Errors = $Process.StandardError.ReadToEndAsync()
    $Stream = [System.IO.File]::Create($Destination)
    try { $Process.StandardOutput.BaseStream.CopyTo($Stream) } finally { $Stream.Dispose() }
    $Process.WaitForExit()
    $ErrorText = $Errors.Result
    $Code = $Process.ExitCode
    $Process.Dispose()
    if ($Code -ne 0) { throw "git exited ${Code}: $ErrorText" }
}
function Write-Utf8([string]$Path, [string]$Value) {
    [System.IO.File]::WriteAllText($Path, $Value + "`n", (New-Object System.Text.UTF8Encoding($false)))
}
try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Blocked 'Git is unavailable.' }
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Blocked 'Docker is unavailable.' }
    $Root = (& git rev-parse --show-toplevel)
    if ($LASTEXITCODE -ne 0) { Blocked 'Run from a MoneyBuddy checkout.' }
    $Root = [System.IO.Path]::GetFullPath($Root)
    Set-Location -LiteralPath $Root
    if ($Command -notin @('build','doctor','all','compare','exec','review','helper','ci-app','ci-publication','ci-browser','ci-deploy')) { Blocked "Unknown command: $Command" }
    $DockerOS = & docker info --format '{{.OSType}}' 2>$null
    if ($LASTEXITCODE -ne 0) { Blocked 'Docker is not running or this client cannot reach it. Start Docker with Linux containers.' }
    if ($DockerOS -ne 'linux') { Blocked 'Switch Docker to Linux containers.' }
    $Image = 'moneybuddy-checks:local'
    if ($Command -ne 'build') {
        $CleanupTag = 'moneybuddy-checks:run-' + [guid]::NewGuid().ToString('N')
        $Image = $CleanupTag
    }
    Native docker @('build','--platform','linux/amd64','--tag',$Image,'--file','container/Dockerfile','container')
    if ($Command -eq 'build') { exit 0 }
    $Image = & docker image inspect --format '{{.Id}}' $Image
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect built image.' }
    $Common = @('run','--rm','--init','--platform','linux/amd64','--network','none','--shm-size','1g')
    if ($Command -eq 'doctor') {
        $Code = Run-Process docker ($Common + @('--mount',"type=bind,source=$Root,target=/input/source,readonly",'--env','MB_CHECK_MOUNT_PROBE=1',$Image,'doctor'))
        exit $Code
    }
    if ($Command -in @('review','helper')) {
        if (-not (Test-Path -LiteralPath (Join-Path $Root '.git') -PathType Container)) {
            Blocked 'Lifecycle/helper commands require the primary checkout with its own .git directory; isolated tests support linked checkouts.'
        }
        $Name = [System.IO.Path]::GetFileName($Root)
        $ReviewRoot = $Root + '-reviews'
        if (Test-Path -LiteralPath $ReviewRoot) {
            $Item = Get-Item -LiteralPath $ReviewRoot -Force
            if (-not $Item.PSIsContainer -or ($Item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) { Blocked 'Review directory is an alias or unexpected file; preserved.' }
        } else { [void][System.IO.Directory]::CreateDirectory($ReviewRoot) }
        if ($Command -eq 'review') {
            $SavedPreference = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            try { $GitHelp = (& git worktree add -h 2>&1) -join "`n" } finally { $ErrorActionPreference = $SavedPreference }
            if ($GitHelp -notmatch 'relative-paths') { Blocked 'Review needs host Git with relative worktree support (Git 2.48+). Upgrade Git before starting a container review.' }
            $Script = 'pre-pr-review'
        } else {
            if ($CommandArgs.Count -eq 0 -or $CommandArgs[0] -notin @('flows','local-variants','publish')) { Blocked 'helper expects flows, local-variants, or publish.' }
            $Script = $CommandArgs[0]
            $CommandArgs = @($CommandArgs | Select-Object -Skip 1)
            if ($Script -eq 'local-variants') {
                $SavedPreference = $ErrorActionPreference
                $ErrorActionPreference = 'Continue'
                try { $GitHelp = (& git worktree add -h 2>&1) -join "`n" } finally { $ErrorActionPreference = $SavedPreference }
                if ($GitHelp -notmatch 'relative-paths') { Blocked 'Variants need host Git with relative worktree support (Git 2.48+).' }
            }
        }
        $DockerArgs = $Common + @('--env','HOME=/tmp','--env','PYTHONDONTWRITEBYTECODE=1',
            '--mount',"type=bind,source=$Root,target=/workspace/$Name",
            '--mount',"type=bind,source=$ReviewRoot,target=/workspace/$Name-reviews",
            '--workdir',"/workspace/$Name",'--env',"MB_HOST_ROOT=$Root",'--env','MB_CONTAINER_PARENT=/workspace',
            '--entrypoint','python3',$Image,"scripts/$Script.py") + $CommandArgs
        $Code = Run-Process docker $DockerArgs
        exit $Code
    }
    $InputMode = 'working-copy'
    $LiteralArgs = $false
    $ForwardArgs = @()
    foreach ($Argument in $CommandArgs) {
        if ($Argument -eq '--' -and -not $LiteralArgs) {
            $LiteralArgs = $true
            $ForwardArgs += $Argument
        } elseif ($Argument -eq '--committed' -and -not $LiteralArgs) {
            $InputMode = 'committed'
        } else {
            $ForwardArgs += $Argument
        }
    }
    if ($Command -like 'ci-*') { $InputMode = 'committed' }
    $CommandArgs = $ForwardArgs
    $RunId = 'run-' + [guid]::NewGuid().ToString('N')
    if ($env:MB_CHECK_RUN_ID) { $RunId = $env:MB_CHECK_RUN_ID }
    if ($RunId -notmatch '^[a-zA-Z0-9][a-zA-Z0-9_-]*$') { Blocked 'MB_CHECK_RUN_ID must contain only letters, numbers, underscores and hyphens.' }
    $OutputRoot = Join-Path $Root '.container-checks'
    if ($env:MB_CHECK_OUTPUT_ROOT) {
        if (-not [System.IO.Path]::IsPathRooted($env:MB_CHECK_OUTPUT_ROOT) -or -not (Test-Path -LiteralPath $env:MB_CHECK_OUTPUT_ROOT -PathType Container)) { Blocked 'MB_CHECK_OUTPUT_ROOT must be an existing absolute directory.' }
        $OutputRoot = [System.IO.Path]::GetFullPath($env:MB_CHECK_OUTPUT_ROOT)
    }
    $InputDir = Join-Path $OutputRoot "inputs/$RunId"
    $ReportDir = Join-Path $OutputRoot "reports/$RunId"
    foreach ($Full in @($OutputRoot,(Join-Path $OutputRoot 'inputs'),(Join-Path $OutputRoot 'reports'))) {
        if (Test-Path -LiteralPath $Full) {
            $Item = Get-Item -LiteralPath $Full -Force
            if (-not $Item.PSIsContainer -or ($Item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) { Blocked 'Output directory is an alias or unexpected file; preserved.' }
        }
    }
    if ((Test-Path -LiteralPath $InputDir) -or (Test-Path -LiteralPath $ReportDir)) { Blocked 'Run ID already exists; choose a new ID to preserve evidence.' }
    [void][System.IO.Directory]::CreateDirectory($InputDir)
    [void][System.IO.Directory]::CreateDirectory($ReportDir)
    $SourceHead = & git rev-parse HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve HEAD.' }
    $CaptureState = (& git status --porcelain=v1 --untracked-files=all) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect checkout.' }
    Write-Utf8 (Join-Path $InputDir 'head.txt') $SourceHead
    Write-Utf8 (Join-Path $InputDir 'mode.txt') $InputMode
    Native git @('bundle','create',(Join-Path $InputDir 'repo.bundle'),'--all','HEAD')
    $Origin = & git config --get remote.origin.url
    Write-Utf8 (Join-Path $InputDir 'origin.txt') ([string]$Origin)
    Git-Bytes @('ls-files','-z','--cached','--others','--exclude-standard') (Join-Path $InputDir 'files.z')
    Git-Bytes @('ls-files','-z','--deleted') (Join-Path $InputDir 'deleted.z')
    Git-Bytes @('ls-files','--stage','-z') (Join-Path $InputDir 'index.z')
    $ImageId = $Image
    if ($Command -eq 'ci-deploy') { $Common = @('run','--rm','--init','--platform','linux/amd64','--network','bridge','--shm-size','1g') }
    $DockerArgs = $Common + @('--env','HOME=/tmp','--mount','type=volume,target=/work',
        '--mount',"type=bind,source=$Root,target=/input/source,readonly",
        '--mount',"type=bind,source=$InputDir,target=/input/git,readonly",
        '--mount',"type=bind,source=$ReportDir,target=/reports",
        '--env','BASE','--env','HEAD_SHA','--env','PR_BODY','--env','BEFORE','--env','PUBLICATION_REF','--env','MB_FETCHED_MAIN',
        '--env',"MB_CHECK_IMAGE_ID=$ImageId",$Image,$Command) + $CommandArgs
    $Result = Run-Process docker $DockerArgs
    $FinalHead = & git rev-parse HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Cannot recheck HEAD; verification remains incomplete.' }
    $FinalState = (& git status --porcelain=v1 --untracked-files=all) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw 'Cannot recheck checkout; verification remains incomplete.' }
    if ($FinalHead -ne $SourceHead -or $FinalState -ne $CaptureState) {
        Write-Utf8 (Join-Path $ReportDir 'host-capture-status.txt') 'BLOCKED: checkout changed during verification; repeat checks.'
        Write-Host 'BLOCKED  Checkout changed during verification; repeat checks.'
        $Result = 2
    }
    Write-Host "Reports: $ReportDir"
    exit $Result
} catch { Blocked $_.Exception.Message }
finally {
    if ($CleanupTag) {
        try { & docker image rm $CleanupTag *> $null } catch { }
    }
}
