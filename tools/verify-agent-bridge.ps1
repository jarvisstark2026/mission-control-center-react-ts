param(
  [string[]]$Urls = @(
    "http://127.0.0.1:8787"
  ),
  [int]$TimeoutSeconds = 5
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

function Get-StatusUrl {
  param([string]$Url)

  $trimmed = $Url.TrimEnd("/")
  if ($trimmed.EndsWith("/status")) {
    return $trimmed
  }
  return "$trimmed/status"
}

Write-Host "Mission Control agent bridge verification"
Write-Host ""

$localPorts = Get-NetTCPConnection -LocalPort 8787 -ErrorAction SilentlyContinue
if ($localPorts) {
  Write-Host "Local TCP listeners on 8787:"
  $localPorts | Select-Object LocalAddress, LocalPort, State, OwningProcess | Format-Table -AutoSize
} else {
  Write-Host "No local TCP listener detected by Get-NetTCPConnection before HTTP probes."
}

Write-Host ""

$connected = $false
$results = foreach ($url in $Urls) {
  $statusUrl = Get-StatusUrl -Url $url
  $startedAt = Get-Date

  try {
    $response = Invoke-RestMethod -Uri $statusUrl -TimeoutSec $TimeoutSeconds
    $elapsedMs = [int]((Get-Date) - $startedAt).TotalMilliseconds
    $connected = $true

    [pscustomobject]@{
      Url = $statusUrl
      Reachable = $true
      Status = $response.status
      Provider = $response.provider
      Engine = $response.activeEngine
      ElapsedMs = $elapsedMs
      Error = ""
    }
  } catch {
    $elapsedMs = [int]((Get-Date) - $startedAt).TotalMilliseconds
    [pscustomobject]@{
      Url = $statusUrl
      Reachable = $false
      Status = ""
      Provider = ""
      Engine = ""
      ElapsedMs = $elapsedMs
      Error = $_.Exception.Message
    }
  }
}

$results | Format-Table -AutoSize

if ((-not $localPorts) -and ($results | Where-Object { $_.Reachable -and $_.Url -like "http://127.0.0.1:*" })) {
  Write-Host ""
  Write-Host "Local HTTP probe succeeded, so the bridge is reachable even though the TCP precheck did not report it."
}

if (-not $connected) {
  Write-Host ""
  Write-Host "No bridge endpoint is reachable."
  Write-Host "Start it on the Hermes PC with:"
  Write-Host '  npm run agent:bridge:lan'
  Write-Host "Or run tools\start-agent-bridge.ps1 with -OpenFirewall from an elevated PowerShell."
  exit 1
}

Write-Host ""
Write-Host "At least one bridge endpoint is reachable. Use that URL in Mission Control Agent Control."
