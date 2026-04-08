param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('snapshot', 'action')]
  [string]$Command,

  [string]$Action,

  [string]$InputJson = '{}'
)

$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding

$baseUrl = $env:OPENCLAW_CLAWTOK_BASE_URL
$agentKey = $env:OPENCLAW_CLAWTOK_AGENT_KEY

if ([string]::IsNullOrWhiteSpace($baseUrl)) {
  throw 'OPENCLAW_CLAWTOK_BASE_URL is not set.'
}

if ([string]::IsNullOrWhiteSpace($agentKey)) {
  throw 'OPENCLAW_CLAWTOK_AGENT_KEY is not set.'
}

$headers = @{
  'x-openclaw-agent-key' = $agentKey
}

function Invoke-ClawTokRequest {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Method,

    [Parameter(Mandatory = $true)]
    [string]$Uri,

    [object]$Body
  )

  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers
  }

  $jsonBody = $Body | ConvertTo-Json -Depth 20
  $utf8Body = [System.Text.Encoding]::UTF8.GetBytes($jsonBody)

  return Invoke-RestMethod `
    -Method $Method `
    -Uri $Uri `
    -Headers ($headers + @{ 'Content-Type' = 'application/json; charset=utf-8' }) `
    -Body $utf8Body
}

if ($Command -eq 'snapshot') {
  $response = Invoke-ClawTokRequest -Method 'GET' -Uri "$baseUrl/api/agent/snapshot"
  [Console]::Out.WriteLine(($response | ConvertTo-Json -Depth 20))
  exit 0
}

if ([string]::IsNullOrWhiteSpace($Action)) {
  throw 'The -Action parameter is required when Command is action.'
}

$input = $InputJson | ConvertFrom-Json
$body = @{
  action = $Action
  input = $input
}

$response = Invoke-ClawTokRequest -Method 'POST' -Uri "$baseUrl/api/agent/action" -Body $body
[Console]::Out.WriteLine(($response | ConvertTo-Json -Depth 20))
