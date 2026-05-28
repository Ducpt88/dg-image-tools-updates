$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$RunDir = Join-Path $Root '.codex-run'
$LogDir = Join-Path $RunDir 'service-logs'
$Cloudflared = Join-Path $env:APPDATA '9router\bin\cloudflared.exe'
$DbPath = Join-Path $env:APPDATA '9router\db\data.sqlite'

New-Item -ItemType Directory -Force -Path $RunDir, $LogDir | Out-Null

function Stop-PortProcess {
  param([int]$Port)
  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}

function Get-RouterApiKey {
  $script = @"
import sqlite3, os
db = r"$DbPath"
con = sqlite3.connect(db)
row = con.execute("select key from apiKeys where isActive=1 limit 1").fetchone()
print(row[0] if row else "")
"@
  $key = $script | python -
  if (-not $key) {
    throw "Khong tim thay API key active trong $DbPath"
  }
  return $key.Trim()
}

if (-not (Test-Path $Cloudflared)) {
  throw "Khong tim thay cloudflared tai $Cloudflared"
}

$routerApiKey = Get-RouterApiKey

Stop-PortProcess -Port 3040

$env:NODE_ENV = 'production'
$env:JWT_SECRET = 'dg-image-tools-local-tunnel-secret-2026-change-later'
$env:ADMIN_EMAIL = 'admin-tunnel@dg.local'
$env:ADMIN_PASSWORD = if ($env:DG_BACKEND_ADMIN_PASSWORD) {
  $env:DG_BACKEND_ADMIN_PASSWORD
} else {
  'local-admin-password-not-for-customer-login'
}
$env:ALLOW_LOCAL_ADMIN = 'false'
$env:DATA_DIR = Join-Path $Root 'server\data'
$env:PORT = '3040'
$env:ROUTER_IMAGE_ENDPOINT = 'http://localhost:20128/v1/images/generations'
$env:ROUTER_API_KEY = $routerApiKey

$backendOut = Join-Path $LogDir 'backend.out.log'
$backendErr = Join-Path $LogDir 'backend.err.log'
$backend = Start-Process -FilePath 'node' `
  -ArgumentList 'server/index.js' `
  -WorkingDirectory $Root `
  -WindowStyle Hidden `
  -RedirectStandardOutput $backendOut `
  -RedirectStandardError $backendErr `
  -PassThru

Start-Sleep -Seconds 3
Invoke-RestMethod -Uri 'http://localhost:3040/healthz' -TimeoutSec 15 | Out-Null

Get-Process cloudflared -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -eq $Cloudflared } |
  Stop-Process -Force -ErrorAction SilentlyContinue

$tunnelOut = Join-Path $LogDir 'cloudflared.out.log'
$tunnelErr = Join-Path $LogDir 'cloudflared.err.log'
$tunnel = Start-Process -FilePath $Cloudflared `
  -ArgumentList @('tunnel', '--url', 'http://localhost:3040', '--no-autoupdate') `
  -WorkingDirectory $Root `
  -WindowStyle Hidden `
  -RedirectStandardOutput $tunnelOut `
  -RedirectStandardError $tunnelErr `
  -PassThru

Start-Sleep -Seconds 8

$publicUrl = ''
if (Test-Path $tunnelErr) {
  $match = Select-String -Path $tunnelErr -Pattern 'https://[-a-z0-9]+\.trycloudflare\.com' |
    Select-Object -Last 1
  if ($match) {
    $publicUrl = $match.Matches[0].Value
    Set-Content -Path (Join-Path $RunDir 'public-backend-url.txt') -Value $publicUrl -Encoding UTF8
  }
}

[pscustomobject]@{
  backendPid = $backend.Id
  tunnelPid = $tunnel.Id
  backend = 'http://localhost:3040'
  publicUrl = $publicUrl
  logs = $LogDir
} | ConvertTo-Json
