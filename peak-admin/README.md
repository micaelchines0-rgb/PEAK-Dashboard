# PEAK ADMIN (web)

Painel administrativo para navegador, separado do aplicativo Tauri PEAK Dashboard para Windows.

## Arquitetura aprovada

- PEAK ADMIN: web, somente administrador autorizado gerencia operadores, remuneração, bloqueios e relatórios.
- PEAK Dashboard: desktop Windows, operadores autenticados com username e senha; internet obrigatória para qualquer operação.
- Supabase: Auth, perfis, operações, comissões históricas e RLS.
- Administrador inicial: username `atx`. Nenhuma senha deve ser versionada no GitHub.

## Segurança e etapas pendentes

1. Criar fluxo de provisionamento inicial do administrador sem senha hardcoded.
2. Criar API autenticada para username + senha; não expor service-role key ao navegador nem ao desktop.
3. Criar backend administrativo autorizado para criar/desativar operadores e alterar remuneração.
4. Revalidar autorização no servidor a cada operação, bloquear em caso de perda de conexão.
5. Registrar serviços no banco central com autoria, idempotência e auditoria antes de permitir fechamento.
6. Implementar frontend web responsivo e publicar em hospedagem compatível com uso comercial.
7. Testar Windows, autenticação, RLS, suspensão, quedas de internet e build antes da distribuição.

**Estado atual:** documentação da arquitetura. Este diretório ainda não contém o painel web executável.
