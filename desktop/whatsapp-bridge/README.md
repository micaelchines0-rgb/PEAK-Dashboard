# WhatsApp PEAK — integrado ao instalador Windows (V11.3.4)

O instalador Windows inclui Node.js, dependências do conector e Chromium. A Dashboard inicia o serviço local automaticamente ao abrir e encerra ao fechar. Cada operador escaneia o QR Code com seu WhatsApp pessoal e seleciona o grupo das blogueiras.

Para desenvolvimento sem instalador: execute `npm install` e `npm start` nesta pasta.

O conector é não oficial e pode sofrer desconexão ou bloqueio. A sessão pessoal e o token local são guardados em `~/.peak-whatsapp-bridge` e não devem ser compartilhados.

**Limitações ainda existentes:** não há sincronização central de pedidos entre operadores; cada PC mantém seu estado local, e dois operadores podem assumir o mesmo pedido. O aplicativo exibe apenas novas mensagens recebidas. A compilação Windows e o fluxo de QR Code ainda precisam ser validados em uma instalação real.
