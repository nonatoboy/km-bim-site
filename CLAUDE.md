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
- No navegador, o Supabase é usado pelo formulário de orçamento (insert), pelas vagas dos eventos (rpc `vagas_restantes`), pelas Edge Functions `inscrever`/`inscricao` (inscrição e confirmação de eventos, e-mails via Resend) e pelo painel `/admin` (login + CRUD).
- Lista de espera: status `lista_espera` (fila por `espera_desde`). `confirmar_inscricao` põe na fila quando não há vaga ou já há fila; `promover_lista_espera` (service role) preenche vagas livres e a Edge Function `inscricao` envia os e-mails (inclusive pela ação `promover`, chamada pelo painel com login de admin).
- `eventos.link_acesso` e `instrucoes_acesso` são privados: o papel `anon` só tem SELECT nas colunas públicas. Ao adicionar colunas públicas em `eventos`, inclua-as no GRANT.
- Convites individuais: tabela `convidados` (só admin; link pessoal `?c={token}`, rpc `abrir_convite` registra a abertura, exceto a menos de 2 min de um envio (robôs do LinkedIn e de e-mail), e preenche o formulário), textos privados `eventos.convite_*` e Edge Function `convites` (envio em lote pelo Resend com limite diário, lembrete, teste e webhook assinado do Resend para entregue/aberto/devolvido). A `inscrever` grava `convidado_id`.
- Enquetes ao vivo: tabelas `enquetes`, `perguntas_enquete`, `respostas_enquete` (só admin; o `anon` usa as rpcs `entrar_enquete`, `responder_enquete` e `projecao_enquete`). O painel conduz pela rpc `controlar_enquete`, que manda um único aviso pelo Realtime Broadcast (canal público `enquete:{código}`, via `realtime.send`); os celulares então consultam o estado. A projeção (`/enquete/projecao?t={token_projecao}`) e o painel consultam a cada 1,5 a 2 s, sem Realtime, para não estourar a cota de mensagens. O painel não embute `perguntas_enquete` a partir de `enquetes` (há duas FKs entre elas, por causa de `pergunta_atual_id`): as contagens são consultas separadas.
- Eventos com `listado = false` têm página e inscrições, mas ficam fora de `/eventos` e da home, com `noindex` (eventos exclusivos, divulgados só pelo link).
- Segurança nas políticas RLS (`supabase/migrations/`). Mudanças de banco entram como **nova** migration, nunca editando uma já aplicada; o README explica que o dono aplica via SQL Editor.
- Deploy: `.github/workflows/publicar.yml` (push na main, `repository_dispatch: publicar` ou manual) → FTP.

## Convenções

- Nomes de arquivos, variáveis, tabelas e colunas em português, sem acentos (`solucoes`, `pedidos_orcamento`).
- Cores e fontes só pelos tokens de `src/styles/global.css`; a paleta oficial está em `brand/README.md`.
- Textos do site: diretos, sem jargão de marketing, sem citar clientes ou ex-empregadores pelo nome.
- Ao adicionar coluna de conteúdo: migration + `src/lib/tipos.ts` + `src/lib/conteudo.ts` + campo em `TABELAS` de `src/scripts/admin.ts` + `conteudo-inicial.json` e `npm run seed`.

## Skills do projeto

- `criar-evento` (`.claude/skills/criar-evento/SKILL.md`): planejar um evento, redigir textos, gerar artes (`brand/scripts/gerar-arte-evento.cjs`) e montar a ficha do painel. Material de cada evento fica em `brand/eventos/{slug}/`.
