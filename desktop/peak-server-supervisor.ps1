param([Parameter(Mandatory=$true)][string]$TailScaleIP)
$ErrorActionPreference = 'Stop'
if ($TailScaleIP -notmatch '^100\.(\d{1,3}\.){2}\d{1,3}$') { throw 'IP Tailscale invalido' }
$mutex = [System.Threading.Mutex]::new($false, 'Local\PEAK_Server_Supervisor')
$acquired = $false
try {
 $acquired = $mutex.WaitOne(0)
 if (-not $acquired) { exit 0 }
 $root = Split-Path -Parent $MyInvocation.MyCommand.Path
 $bridge = Join-Path $root 'whatsapp-bridge'
 $entry = Join-Path $bridge 'server.mjs'
 $node = (Get-Command node.exe -ErrorAction Stop).Source
 if (-not (Test-Path (Join-Path $bridge 'node_modules\whatsapp-web.js'))) { throw 'Execute primeiro npm.cmd install na pasta whatsapp-bridge' }
 $dataRoot = Join-Path $env:LOCALAPPDATA 'PEAK-Server'
 New-Item -ItemType Directory -Path $dataRoot -Force | Out-Null
 $log = Join-Path $dataRoot 'supervisor.log'
 function Write-PeakLog([string]$message) {
  Add-Content -Path $log -Value ("{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'),$message)
 }
 Write-PeakLog 'Supervisor iniciado'
 while ($true) {
  try {
   $ipReady = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -eq $TailScaleIP }).Count -gt 0
   if (-not $ipReady) { Start-Sleep -Seconds 15; continue }
   for ($i=1; $i -le 5; $i++) {
    $port = 38740 + $i
    $operator = "operador$i"
    $existing = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
    if ($existing.Count -gt 0) { continue }
    $data = Join-Path $dataRoot $operator
    New-Item -ItemType Directory -Path $data -Force | Out-Null
    $env:PEAK_OPERATOR_ID = $operator
    $env:PEAK_DATA_DIR = $data
    $env:PEAK_PORT = [string]$port
    $env:PEAK_BIND = $TailScaleIP
    $out = Join-Path $data 'stdout.log'
    $err = Join-Path $data 'stderr.log'
    # Rotate logs before starting a new process; never touch WhatsApp session folders.
    foreach ($file in @($out,$err)) {
     if ((Test-Path $file) -and (Get-Item $file).Length -gt 10MB) {
      Move-Item $file ($file + '.previous') -Force -ErrorAction SilentlyContinue
     }
    }
    try {
     $p = Start-Process -FilePath $node -ArgumentList @($entry) -WorkingDirectory $bridge -WindowStyle Hidden -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
     Write-PeakLog ("Iniciado {0} porta {1} PID {2}" -f $operator,$port,$p.Id)
    } catch { Write-PeakLog ("Falha {0}: {1}" -f $operator,$_.Exception.Message) }
   }
  } catch { Write-PeakLog ("Erro supervisor: {0}" -f $_.Exception.Message) }
  finally {
   Remove-Item Env:PEAK_OPERATOR_ID,Env:PEAK_DATA_DIR,Env:PEAK_PORT,Env:PEAK_BIND -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 30
 }
} finally {
 if ($acquired) { $mutex.ReleaseMutex() }
 $mutex.Dispose()
}
