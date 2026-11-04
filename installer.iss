#define MyAppName "PEAK Dashboard"
#define MyAppVersion "10.1.1"
#define MyAppExeName "PEAK Dashboard.exe"
[Setup]
AppId={{2CEB24CB-9884-45F7-90EF-6B7643DAE57B}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=PEAK
DefaultDirName={localappdata}\Programs\PEAK Dashboard
DefaultGroupName=PEAK Dashboard
PrivilegesRequired=lowest
OutputDir=installer
OutputBaseFilename=PEAK_Dashboard_V10_1_1_Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=PEAK.ico
UninstallDisplayIcon={app}\PEAK.ico
[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
[Files]
Source: "dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "PEAK.ico"; DestDir: "{app}"; Flags: ignoreversion
[Icons]
Name: "{group}\PEAK Dashboard"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\PEAK.ico"
Name: "{autodesktop}\PEAK Dashboard"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\PEAK.ico"; Tasks: desktopicon
[Tasks]
Name: "desktopicon"; Description: "Criar atalho na Area de Trabalho"; GroupDescription: "Atalhos:"
[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Abrir PEAK Dashboard"; Flags: nowait postinstall skipifsilent
