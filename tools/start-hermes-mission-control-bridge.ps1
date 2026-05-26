param(
  [string]$BindHost = "0.0.0.0",
  [int]$BridgePort = 8787,
  [string]$HermesApiBaseUrl = "http://127.0.0.1:8642/v1",
  [string]$HermesModel = "hermes-agent",
  [string]$HermesApiKey = "",
  [switch]$OpenFirewall,
  [string]$NodePath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$bridgePath = Join-Path $repoRoot "tools\hermes-mission-control-bridge.mjs"

if (-not (Test-Path -LiteralPath $bridgePath)) {
  throw "Hermes Mission Control bridge not found at $bridgePath"
}

function Resolve-NodePath {
  param([string]$RequestedNodePath)

  if ($RequestedNodePath -and (Test-Path -LiteralPath $RequestedNodePath)) {
    return (Resolve-Path -LiteralPath $RequestedNodePath).Path
  }

  $codexNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  if (Test-Path -LiteralPath $codexNode) {
    return $codexNode
  }

  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if ($nodeCommand) {
    return $nodeCommand.Source
  }

  throw "Node.js was not found. Install Node 20.19+, 22.13+, or 24+, or pass -NodePath."
}

$node = Resolve-NodePath -RequestedNodePath $NodePath
$nodeVersion = & $node --version

if ($OpenFirewall) {
  $ruleName = "Mission Control Hermes Bridge $BridgePort"
  $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

  if (-not $existingRule) {
    Write-Host "Creating firewall rule: $ruleName"
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $BridgePort -Action Allow | Out-Null
  } else {
    Write-Host "Firewall rule already exists: $ruleName"
  }
}

$env:AGENT_BRIDGE_HOST = $BindHost
$env:AGENT_BRIDGE_PORT = [string]$BridgePort
$env:HERMES_API_BASE_URL = $HermesApiBaseUrl
$env:HERMES_MODEL = $HermesModel
if ($HermesApiKey) {
  $env:HERMES_API_KEY = $HermesApiKey
}

Write-Host "Mission Control real Hermes bridge starting"
Write-Host "Bind:       $BindHost`:$BridgePort"
Write-Host "Hermes API: $HermesApiBaseUrl"
Write-Host "Model:      $HermesModel"
Write-Host "Node:       $nodeVersion ($node)"
Write-Host ""
Write-Host "Mission Control status: http://127.0.0.1:$BridgePort/status"
Write-Host "Hermes API must be running before /tasks can create proposals."
Write-Host "Stop with Ctrl+C."
Write-Host ""

Set-Location -LiteralPath $repoRoot
& $node $bridgePath
