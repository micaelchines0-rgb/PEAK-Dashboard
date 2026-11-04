PEAK DASHBOARD V10 — PYTHON / WINDOWS

Este pacote contém o código-fonte de um aplicativo desktop nativo em Python (Tkinter).
Não é o instalador .exe pronto: a compilação precisa ser executada no Windows.

COMO GERAR UM INSTALADOR COM JANELA DE INSTALAÇÃO
1. Instale Python 3.11 ou 3.12 para Windows, incluindo o launcher "py".
2. Abra build_windows.bat. Ele instala dependências e cria dist\PEAK Dashboard.exe.
3. Instale Inno Setup 6 (gratuito).
4. Abra build_installer.bat.
5. O instalador com assistente ficará em installer\PEAK_Dashboard_V10_Setup.exe.

FUNCIONALIDADES
- Interface desktop preta e compacta, sem navegador ou servidor localhost.
- Dragão D5/D7/D9/D11, Pinguim P6/P8 e comanda PIX.
- Bloco de notas e calculadora de soma.
- Cadastro, edição e exclusão de operações; telefone e data ocultos da tabela.
- Gerador de depósitos com faixas 11–15, 15–18, 19–25 e personalizada.
- Fechamento diário em Excel XLSX, com resumo e dados completos.
- Banco de dados SQLite e preferências em %%APPDATA%%\PEAK_Dashboard.
- Divisória horizontal ajustável pelo mouse; altura do bloco de notas pelo puxador inferior.

IMPORTANTE
- Esta é uma reconstrução inicial em Python, não uma conversão visual idêntica pixel a pixel.
- Faça backup de %%APPDATA%%\PEAK_Dashboard regularmente.
- O fechamento remove registros do painel SOMENTE após salvar o arquivo Excel com sucesso.
- Os dados da versão HTML antiga não são importados automaticamente.
- Nenhum instalador Windows foi compilado ou testado neste ambiente Linux.

ATUALIZACOES VIA GITHUB RELEASES
1. Crie um repositorio publico no GitHub (ex.: usuario/peak-dashboard).
2. No app, clique em "Configurar GitHub" e informe usuario/repositorio.
3. Compile o aplicativo no Windows com build_windows.bat.
4. Gere o instalador com build_installer.bat.
5. Execute build_release.bat para gerar PEAK_Dashboard_Setup.exe.sha256.
6. Crie um GitHub Release com tag v10.0.0 e publique os DOIS arquivos:
   installer\PEAK_Dashboard_Setup.exe
   installer\PEAK_Dashboard_Setup.exe.sha256
7. Para a proxima versao, atualize VERSION em updater.py e MyAppVersion em installer.iss;
   gere novo instalador, novo SHA256 e publique Release com tag maior (ex.: v10.1.0).
8. Ao iniciar, o aplicativo verifica a ultima versao. O usuario confirma download
   e, depois da verificacao SHA-256, confirma abertura do instalador.

AVISOS: A API de Releases para repositorio privado exige autenticacao e nao
funciona com este mecanismo sem adaptacao. SHA-256 protege contra downloads
corrompidos, mas NAO autentica o publicador; proteja o GitHub com 2FA e,
para distribuicao ampla, assine digitalmente o instalador.
O aplicativo nao realiza atualizacoes sem o repositorio configurado.
O programa nunca instala atualizacoes sem confirmacao.
