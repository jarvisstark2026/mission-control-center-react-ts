$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$bundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if (Test-Path -LiteralPath $bundledNode) {
  $node = $bundledNode
} else {
  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if (-not $nodeCommand) {
    throw "Node.js was not found. Install Node or run inside the Codex desktop runtime."
  }
  $node = $nodeCommand.Source
}

$nodeDir = Split-Path -Parent $node
$localBin = Join-Path $repoRoot "node_modules\.bin"
$tauri = Join-Path $localBin "tauri.cmd"
$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"

if (-not (Test-Path -LiteralPath $tauri)) {
  throw "Tauri CLI is not installed. Run dependency install first, then retry."
}

$env:Path = "$cargoBin;$localBin;$nodeDir;$env:Path"
Set-Location -LiteralPath $repoRoot

& $tauri dev
