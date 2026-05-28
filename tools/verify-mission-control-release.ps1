param(
  [switch]$SkipDesktopBuild,
  [switch]$SkipDesktopSmoke
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$bundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if (Test-Path $bundledNode) {
  $env:Path = "$bundledNode;$cargoBin;$env:Path"
}

$nodeVersion = (& node --version)
Write-Host "Node: $nodeVersion"

$commands = @(
  "npm run typecheck",
  "npm run lint",
  "npm run test:run",
  "npm run build",
  "npm run test:e2e"
)

if (-not $SkipDesktopBuild) {
  $commands += "npm run desktop:build"
}

foreach ($command in $commands) {
  Write-Host ""
  Write-Host "==> $command"
  powershell -NoProfile -ExecutionPolicy Bypass -Command $command
  if ($LASTEXITCODE -ne 0) {
    throw "Release verification failed at: $command"
  }
}

if (-not $SkipDesktopSmoke) {
  $exe = Join-Path $repoRoot "src-tauri\target\release\mission-control-center.exe"
  if (-not (Test-Path $exe)) {
    throw "Release executable not found: $exe"
  }

  Write-Host ""
  Write-Host "==> desktop smoke"
  $process = Start-Process -FilePath $exe -PassThru -WindowStyle Hidden
  Start-Sleep -Seconds 8
  $alive = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
  if (-not $alive) {
    throw "Desktop smoke failed: mission-control-center did not stay running."
  }
  Stop-Process -Id $process.Id -Force
  Write-Host "Desktop smoke passed: pid $($process.Id)"
}

Write-Host ""
Write-Host "Mission Control release verification passed."
