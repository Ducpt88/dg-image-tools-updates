$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$StartScript = Join-Path $PSScriptRoot 'start-local-public-backend.ps1'
$TaskName = 'DG Image Tools Local Public Backend'
$Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$StartScript`""
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Days 365) `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Description 'Starts DG Image Tools backend and Cloudflare public tunnel for remote users.' `
  -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName

[pscustomobject]@{
  taskName = $TaskName
  status = 'installed_and_started'
  root = $Root
} | ConvertTo-Json
