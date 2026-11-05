# Conector WhatsApp da PEAK — versão experimental

Este serviço usa whatsapp-web.js (não oficial). Cada operador executa **uma instância local** no próprio Windows, com seu WhatsApp pessoal. Há risco de desconexão ou bloqueio do número.

## Instalação no computador de cada operador

1. Instale Node.js 22 ou superior.
2. Abra um terminal na pasta `desktop/whatsapp-bridge`.
3. Execute `npm install` (na primeira vez) e depois `npm start`.
4. Abra a PEAK Dashboard e entre com o usuário e senha.
5. Escaneie o QR Code exibido no painel direito com o WhatsApp pessoal.
6. Selecione o grupo das blogueiras. O operador precisa ser membro do grupo.

O serviço só escuta em `127.0.0.1:38741` e exige token local aleatório, salvo em `~/.peak-whatsapp-bridge/token`. A sessão do WhatsApp fica em `~/.peak-whatsapp-bridge/session`. **Nunca compartilhe nem envie essas pastas ao GitHub.**

## Limitações atuais

- O serviço precisa permanecer aberto; ainda não está empacotado no instalador NSIS.
- Os pedidos ficam no computador de cada operador. **Ainda não há sincronização compartilhada de pedidos, bloqueio de atendimento concorrente nem registro centralizado de qual operador assumiu o pedido**.
- Somente novas mensagens recebidas após a conexão são exibidas; não há importação do histórico do grupo.
- As respostas são enviadas com o número WhatsApp pessoal conectado naquele computador.
- O QR Code é produzido pela sessão real do WhatsApp Web; não é um QR simulado.
- Antes de distribuir a todos, teste com um grupo e número dedicados. Respeite privacidade, consentimento e as regras da plataforma.
