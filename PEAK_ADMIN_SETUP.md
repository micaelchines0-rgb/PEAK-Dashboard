# PEAK ADMIN — implantação inicial

O projeto contém o esquema inicial de dados do painel privado. **Ainda não está hospedado, nem sincronizando dados.**

## Configuração segura
1. Crie um projeto Supabase próprio e habilite autenticação por e-mail com MFA para o administrador.
2. Crie sua conta no Supabase Auth. Desabilite cadastro público e convites não autorizados.
3. Execute `supabase/schema.sql` no SQL Editor.
4. Insira manualmente seu UUID de Auth na tabela `public.peak_admins` pelo SQL Editor (não use e-mail/senha no código).
5. Configure backups e verifique retenção, exclusão e direitos dos titulares (LGPD).

## Integração pendente (não ativar sem backend)
- Criar uma API autenticada para cada instalação desktop; nunca usar chave `service_role` no Tauri.
- Adicionar `device_id` persistente e fila SQLite `sync_outbox` transacional, incluindo exclusões e fechamento diário.
- Fazer envio em lotes com repetição segura (upsert por `device_id,local_order_id`), TLS e retries.
- Preservar registros históricos no servidor quando o fechamento diário apagar a tabela local.
- Criar o site com login, MFA e relatórios; ler apenas com RLS, validar políticas com usuários não-admin.
- Testar modo offline, múltiplos dispositivos, duplicatas, falhas parciais e recuperação de backup.
- **Não enviar dados reais de clientes antes de concluir esses itens.**

Indicadores: bruto (definir regra de receita da operação), total de depósitos, saques, blogueiras, lucro líquido = saques + blogueiras - depósitos (mesma fórmula do aplicativo atual). A regra de faturamento bruto deve ser validada com o proprietário.
