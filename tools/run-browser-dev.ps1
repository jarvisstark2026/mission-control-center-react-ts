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
$vite = Join-Path $repoRoot "node_modules\vite\bin\vite.js"

if (-not (Test-Path -LiteralPath $vite)) {
  throw "Vite is not installed. Run dependency install first, then retry."
}

$env:Path = "$localBin;$nodeDir;$env:Path"
Set-Location -LiteralPath $repoRoot

& $node $vite --host 127.0.0.1
