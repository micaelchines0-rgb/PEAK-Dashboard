# PEAK Dashboard — React + TypeScript + Tauri

Nova arquitetura Windows, isolada da versão Python em produção.

## Executar

Instale Node.js LTS, Rust e as dependências do Tauri 2 no Windows. Em `desktop/` execute `npm install`, `npm run tauri dev`. Para gerar o instalador NSIS: `npm run tauri build`.

## Dados existentes

O backend Rust abre o mesmo banco SQLite do aplicativo Python: `%APPDATA%/PEAK_Dashboard/peak.sqlite3`. Faça backup dessa pasta antes de testar. A migração não altera a estrutura das tabelas existentes.

## Segurança de lançamento

Esta versão é uma migração experimental 11.0.0, não uma atualização automática da V10.1.1. Validar exportação, dados e instalação antes de criar release pública.
