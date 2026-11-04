@echo off
setlocal
cd /d "%~dp0"
if not exist "dist\PEAK Dashboard.exe" (
 echo Primeiro execute build_windows.bat
 pause
 exit /b 1
)
set "ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if not exist "%ISCC%" set "ISCC=%ProgramFiles%\Inno Setup 6\ISCC.exe"
if not exist "%ISCC%" (
 echo Instale o Inno Setup 6 e execute novamente.
 pause
 exit /b 1
)
"%ISCC%" installer.iss
if errorlevel 1 (
 echo Falha ao gerar instalador.
 pause
 exit /b 1
)
echo Instalador pronto em installer\PEAK_Dashboard_V10_Setup.exe
pause
