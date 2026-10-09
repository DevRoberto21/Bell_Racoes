; Instalador do Bell Rações (Inno Setup 6). Compilado pelo workflow build-windows.yml:
;   ISCC.exe /DVersao=1.2.3 empacotamento\instalador.iss
; Espera a pasta dist\BellRacoes gerada pelo PyInstaller.

#ifndef Versao
  #define Versao "0.0.0"
#endif

#define Nome "Bell Rações"
#define Executavel "BellRacoes.exe"
#define RegraDeFirewall "Bell Racoes"

[Setup]
AppId={{B3F1D6A2-7C54-4E0B-9A1E-5D2C8F6E4B10}
AppName={#Nome}
AppVersion={#Versao}
AppPublisher={#Nome}
; Pasta fixa e fora de "Arquivos de Programas": a pasta dados fica ao lado do exe e precisa ser gravável.
DefaultDirName=C:\BellRacoes
DisableDirPage=yes
DefaultGroupName={#Nome}
DisableProgramGroupPage=yes
; Administrador é necessário para a regra de firewall.
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\dist
OutputBaseFilename=BellRacoes-Setup
SetupIconFile=bell.ico
UninstallDisplayIcon={app}\{#Executavel}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=no

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Dirs]
; O banco da loja mora aqui. Nunca é removido, nem ao desinstalar.
Name: "{app}\dados"; Permissions: users-modify; Flags: uninsneveruninstall

[InstallDelete]
; Ao atualizar por cima, some com os arquivos da versão anterior. A pasta dados não é tocada.
Type: filesandordirs; Name: "{app}\_internal"

[Files]
Source: "..\dist\BellRacoes\*"; DestDir: "{app}"; Excludes: "dados\*"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{autodesktop}\{#Nome}"; Filename: "{app}\{#Executavel}"; WorkingDir: "{app}"
Name: "{group}\{#Nome}"; Filename: "{app}\{#Executavel}"; WorkingDir: "{app}"
Name: "{group}\Trocar senhas"; Filename: "{app}\{#Executavel}"; Parameters: "criar_caixas"; WorkingDir: "{app}"
Name: "{commonstartup}\{#Nome}"; Filename: "{app}\{#Executavel}"; WorkingDir: "{app}"

[Run]
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""{#RegraDeFirewall}"""; Flags: runhidden
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""{#RegraDeFirewall}"" dir=in action=allow protocol=TCP localport=8000 profile=private"; Flags: runhidden
Filename: "{app}\{#Executavel}"; Description: "Abrir o {#Nome} agora"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "{sys}\taskkill.exe"; Parameters: "/F /IM {#Executavel}"; Flags: runhidden; RunOnceId: "EncerrarSistema"
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""{#RegraDeFirewall}"""; Flags: runhidden; RunOnceId: "RemoverRegraDeFirewall"

[Code]
// Encerra o sistema aberto antes de copiar os arquivos, para a atualização por cima funcionar.
// O banco usa WAL com synchronous=FULL, então o encerramento não corrompe dados.
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Codigo: Integer;
begin
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM {#Executavel}', '', SW_HIDE, ewWaitUntilTerminated, Codigo);
  Sleep(1000);
  Result := '';
end;
