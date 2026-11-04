@echo off
setlocal
cd /d "%~dp0"
if not exist "installer\PEAK_Dashboard_Setup.exe" (
 echo Primeiro execute build_windows.bat e build_installer.bat.
 pause
 exit /b 1
)
certutil -hashfile "installer\PEAK_Dashboard_Setup.exe" SHA256 > "installer\checksum_raw.txt"
powershell -NoProfile -Command "$h=(Get-FileHash 'installer\PEAK_Dashboard_Setup.exe' -Algorithm SHA256).Hash.ToLower(); Set-Content -Encoding ASCII -Path 'installer\PEAK_Dashboard_Setup.exe.sha256' -Value ($h+'  PEAK_Dashboard_Setup.exe')"
del "installer\checksum_raw.txt" 2>nul
echo Publique os dois arquivos da pasta installer em um GitHub Release com tag v10.0.0.
pause
