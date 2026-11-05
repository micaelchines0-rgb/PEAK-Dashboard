# PEAK ADMIN — Web (Beta)

Painel web React + Vite conectado ao Supabase `pnigecdjotqaxktnmnkj`.

## Executar localmente

```bash
cd peak-admin
npm install
npm run dev
```

## Funcionalidades implementadas

- Login de administrador com nome de usuário + senha. Internamente, contas provisionadas usam `<username>@operators.peak.invalid` no Supabase Auth; o usuário nunca precisa informar e-mail.
- Dashboard de métricas, listagem de serviços sincronizados, equipe e comissões.
- Edge Function `peak-admin-operators` implantada no Supabase para cadastrar, ativar/bloquear operadores e alterar comissões; exige token válido e perfil admin ativo.
- RLS para leitura administrativa, mantendo operadores restritos aos próprios dados.

## Pendências para uso real

- Provisionar com segurança a primeira conta de administrador `atx` (não foi criada; nunca incluir senha no repositório).
- Conectar a autenticação por username da Dashboard Windows (a versão atual ainda usa e-mail).
- Implementar sincronização de serviços do Windows para Supabase e políticas de auditoria/consistência.
- Executar testes automatizados e build; publicar hospedagem compatível com uso comercial.
- Implementar recuperação segura de acesso, paginação e histórico de remuneração robusto.

**Atenção:** dados financeiros não aparecem até que a sincronização do desktop seja implementada. Não usar em produção ainda.
