param([Parameter(Mandatory=$true)][string]$TailScaleIP)
$ErrorActionPreference = "Stop"
if ($TailScaleIP -notmatch '^100\.(\d{1,3}\.){2}\d{1,3}$') { throw "Informe o IP Tailscale 100.x.y.z" }
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$bridge = Join-Path $root "whatsapp-bridge"
if (-not (Test-Path (Join-Path $bridge "node_modules"))) {
 Push-Location $bridge
 try { npm install --omit=dev; if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar dependencias" } }
 finally { Pop-Location }
}
$dataRoot = Join-Path $env:LOCALAPPDATA "PEAK-Server"
New-Item -ItemType Directory -Force -Path $dataRoot | Out-Null
$node = (Get-Command node.exe -ErrorAction Stop).Source
$entry = Join-Path $bridge "server.mjs"
for ($i=1; $i -le 5; $i++) {
 $operator = "operador$i"
 $port = 38740 + $i
 $data = Join-Path $dataRoot $operator
 New-Item -ItemType Directory -Force -Path $data | Out-Null
 $env:PEAK_OPERATOR_ID = $operator
 $env:PEAK_DATA_DIR = $data
 $env:PEAK_PORT = "$port"
 $env:PEAK_BIND = $TailScaleIP
 $process = Start-Process -FilePath $node -ArgumentList @($entry) -WorkingDirectory $bridge -PassThru -WindowStyle Minimized -RedirectStandardOutput (Join-Path $data "stdout.log") -RedirectStandardError (Join-Path $data "stderr.log")
 Write-Host ("{0} : {1}:{2} (PID {3})" -f $operator,$TailScaleIP,$port,$process.Id)
}
Remove-Item Env:PEAK_OPERATOR_ID,Env:PEAK_DATA_DIR,Env:PEAK_PORT,Env:PEAK_BIND -ErrorAction SilentlyContinue
Write-Host "Tokens individuais: $dataRoot\operadorN\token"
Write-Host "Nao compartilhe os tokens. Mantenha o acesso privado via Tailscale."
