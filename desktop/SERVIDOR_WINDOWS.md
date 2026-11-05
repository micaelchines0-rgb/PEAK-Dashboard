# PEAK — Servidor Windows (piloto para 5 operadores)

## Pré-requisitos
- Windows 10/11, computador ligado e sem suspensão, internet estável.
- Node.js 22 LTS e Git instalados no computador servidor.
- Tailscale instalado no servidor e em cada computador operador, todos autorizados na mesma rede privada.
- Recomendação inicial: 16 GB de RAM ou mais para cinco navegadores Chromium; testar consumo real.
- Acesso privado e firewall: NÃO abra portas no roteador nem publique a API na internet. Configure regras de firewall do Windows restritas à interface/rede Tailscale e às portas 38741–38745.

## Servidor
1. Faça clone do repositório e abra PowerShell em `desktop`.
2. Descubra o IP 100.x.y.z do servidor no aplicativo Tailscale.
3. Execute `powershell -ExecutionPolicy Bypass -File .\start-peak-server.ps1 -TailScaleIP 100.x.y.z` (substitua pelo IP real).
4. Aguarde a instalação das dependências e confira os logs em `%LOCALAPPDATA%\PEAK-Server\operador1\stderr.log` e `stdout.log`.
5. Cada sessão terá sua própria pasta e token em `%LOCALAPPDATA%\PEAK-Server\operadorN\token`. Guarde cada chave em segredo e entregue individualmente por canal seguro ao operador correspondente.
6. Portas: operador1=38741, operador2=38742, operador3=38743, operador4=38744, operador5=38745.
7. O script inicia os processos, mas ainda NÃO os registra como serviço automático. Após reiniciar o Windows, execute-o novamente. Não execute duas vezes sem encerrar os processos anteriores.

## Cada operador
1. Instale e conecte o Tailscale à rede privada.
2. Abra a Dashboard, faça login, vá à coluna direita e clique em **Configurar servidor PEAK**.
3. Informe o IP Tailscale do computador principal, a porta designada e a chave do operador. Clique **Salvar conexão**.
4. Aguarde o QR Code, leia-o com o WhatsApp pessoal em **Aparelhos conectados**, selecione o grupo e teste.
5. Cada porta usa uma sessão separada. Nunca compartilhe a chave entre operadores.

## Limitações importantes deste piloto
- Não há garantia de 24/7: energia, internet, Windows Update, Tailscale e WhatsApp podem interromper o serviço.
- **Pedidos ainda não estão sincronizados entre as cinco sessões.** Cada operador tem estado local independente; NÃO use a distribuição automática de pedidos em produção até implementar um banco central e reivindicação atômica.
- O WhatsApp Web é integração não oficial; existe risco de bloqueio ou desconexão.
- A configuração remota é armazenada localmente na pasta de dados da Dashboard; proteja o acesso ao Windows.
- Não há provisionamento automático de Tailscale, instalação de Node.js, serviço de inicialização automática nem atualização remota.
- O host Windows deve permitir conexões de entrada privadas nas portas escolhidas; não exponha essas portas publicamente.
