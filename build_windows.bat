@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  echo Python nao encontrado. Instale Python 3.11 ou 3.12 para Windows.
  pause
  exit /b 1
)
py -m venv .venv
if errorlevel 1 goto fail
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 goto fail
python -m PyInstaller --noconfirm --clean --onefile --windowed --add-data "PEAK.ico;." --icon "PEAK.ico" --name "PEAK Dashboard" --collect-all openpyxl main.py
if errorlevel 1 goto fail
echo.
echo EXE criado em dist\PEAK Dashboard.exe
echo Para criar o instalador, instale Inno Setup 6 e execute build_installer.bat
pause
exit /b 0
:fail
echo Erro na compilacao.
pause
exit /b 1
