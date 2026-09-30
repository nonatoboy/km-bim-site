# CLAUDE.md

Site da KM Consultoria BIM Ltda (kmbim.com.br). Conteúdo e interface em português do Brasil.

## Comandos

- `npm run dev`: servidor local em http://localhost:4321
- `npm run build`: gera `dist/` (sempre rodar antes de commitar)
- `npm run check`: verificação de tipos do Astro
- `npm run seed`: regenera `supabase/seed.sql` a partir de `src/data/conteudo-inicial.json`

## Arquitetura

- Astro com `output: 'static'`. A hospedagem (Hostinger Single Web Hosting) só serve arquivos: nada de SSR, API routes ou middleware.
- Conteúdo lido do Supabase **no build** (`src/lib/conteudo.ts`). Sem variáveis de ambiente, usa `src/data/conteudo-inicial.json`.
- No navegador, o Supabase é usado só pelo formulário de orçamento (insert) e pelo painel `/admin` (login + CRUD).
- Segurança nas políticas RLS (`supabase/migrations/`). Mudanças de banco entram como **nova** migration, nunca editando uma já aplicada; o README explica que o dono aplica via SQL Editor.
- Deploy: `.github/workflows/publicar.yml` (push na main, `repository_dispatch: publicar` ou manual) → FTP.

## Convenções

- Nomes de arquivos, variáveis, tabelas e colunas em português, sem acentos (`solucoes`, `pedidos_orcamento`).
- Cores e fontes só pelos tokens de `src/styles/global.css`; a paleta oficial está em `brand/README.md`.
- Textos do site: diretos, sem jargão de marketing, sem citar clientes ou ex-empregadores pelo nome.
- Ao adicionar coluna de conteúdo: migration + `src/lib/tipos.ts` + `src/lib/conteudo.ts` + campo em `TABELAS` de `src/scripts/admin.ts` + `conteudo-inicial.json` e `npm run seed`.
