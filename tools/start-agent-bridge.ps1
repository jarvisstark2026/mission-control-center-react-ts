param(
  [string]$BindHost = "0.0.0.0",
  [int]$Port = 8787,
  [ValidateSet("hermes", "openclaw", "custom")]
  [string]$Provider = "hermes",
  [switch]$OpenFirewall,
  [string]$NodePath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$harnessPath = Join-Path $repoRoot "tools\agent-bridge-harness.mjs"

if (-not (Test-Path -LiteralPath $harnessPath)) {
  throw "Bridge harness not found at $harnessPath"
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
  $ruleName = "Mission Control Agent Bridge $Port"
  $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

  if (-not $existingRule) {
    Write-Host "Creating firewall rule: $ruleName"
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow | Out-Null
  } else {
    Write-Host "Firewall rule already exists: $ruleName"
  }
}

$env:AGENT_BRIDGE_HOST = $BindHost
$env:AGENT_BRIDGE_PORT = [string]$Port
$env:AGENT_BRIDGE_PROVIDER = $Provider

Write-Host "Mission Control agent bridge starting"
Write-Host "Provider: $Provider"
Write-Host "Bind:     $BindHost`:$Port"
Write-Host "Node:     $nodeVersion ($node)"
Write-Host ""
Write-Host "Local status: http://127.0.0.1:$Port/status"
Write-Host "LAN status:   http://<this-pc-lan-ip>:$Port/status"
Write-Host "Stop with Ctrl+C."
Write-Host ""

Set-Location -LiteralPath $repoRoot
& $node $harnessPath
