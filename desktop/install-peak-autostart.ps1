param([string]$TailScaleIP = '100.99.113.31')
$ErrorActionPreference = 'Stop'
if ($TailScaleIP -notmatch '^100\.(\d{1,3}\.){2}\d{1,3}$') { throw 'IP Tailscale invalido' }
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$supervisor = Join-Path $root 'peak-server-supervisor.ps1'
if (-not (Test-Path $supervisor)) { throw 'Supervisor nao encontrado' }
$taskName = 'PEAK WhatsApp Server'
$ps = (Get-Command powershell.exe).Source
$arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $supervisor + '" -TailScaleIP ' + $TailScaleIP
$action = New-ScheduledTaskAction -Execute $ps -Argument $arguments -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn -User ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host "PEAK instalado para iniciar automaticamente ao entrar no Windows."
Write-Host "Tarefa: $taskName"
Write-Host "IP Tailscale: $TailScaleIP"
Write-Host "Status: Get-ScheduledTask -TaskName 'PEAK WhatsApp Server' | Select-Object State"
Write-Host "Logs: $env:LOCALAPPDATA\PEAK-Server\supervisor.log"
