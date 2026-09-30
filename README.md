# kmbim.com.br

Site institucional da **KM Consultoria BIM Ltda**. Páginas estáticas geradas com [Astro](https://astro.build), conteúdo no [Supabase](https://supabase.com) e hospedagem na Hostinger.

```
Painel /admin ──edita──▶ Supabase (banco + imagens)
      │                        ▲
      └─"Publicar"─▶ Edge Function ─▶ GitHub Actions ──lê──┘
                                          │
                                          └─ build ─FTP─▶ Hostinger (kmbim.com.br)

Formulário /orcamento ──grava──▶ Supabase (pedidos_orcamento)
```

- **Páginas:** início, soluções (catálogo com seleção), detalhe de cada solução, quem somos, solicitar orçamento, 404 e painel.
- **Conteúdo editável no painel:** soluções, etapas, parceiros, palestras, publicações, trajetória, depoimentos, textos gerais e pedidos de orçamento.
- **Marca:** logotipo, cores e tipografia em [`brand/`](brand/README.md).

## Configuração (uma vez)

### 1. Banco de dados

No projeto `km-bim-site` do Supabase:

1. **SQL Editor → New query**: cole o conteúdo de [`supabase/migrations/20260930000000_estrutura_inicial.sql`](supabase/migrations/20260930000000_estrutura_inicial.sql) e clique em **Run**.
2. Nova query com o conteúdo de [`supabase/seed.sql`](supabase/seed.sql) → **Run**. Isso carrega o catálogo inicial de soluções, os textos e a trajetória.
3. **Project Settings → API**: anote a **Project URL** e a chave **anon public**. As duas são públicas por natureza; a proteção está nas regras de segurança (RLS) criadas no passo 1.

### 2. Criar seu usuário do painel

1. **Authentication → Users → Add user → Create new user**: e-mail `contato@kmbim.com.br` e uma senha forte. Marque **Auto Confirm User**.
2. **Authentication → Sign In / Providers**: desligue **Allow new users to sign up**, para ninguém mais criar conta.
3. **SQL Editor**, para dar permissão de administrador:

   ```sql
   insert into public.administradores (user_id)
   select id from auth.users where email = 'contato@kmbim.com.br';
   ```

### 3. Botão "Publicar alterações"

1. No GitHub: **Settings (do seu perfil) → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - Repository access: *Only select repositories* → `km-bim-site`.
   - Permissions → Repository permissions → **Contents: Read and write**.
   - Copie o token gerado.
2. No Supabase: **Edge Functions → Deploy a new function → Via Editor**, nome `publicar`, cole o conteúdo de [`supabase/functions/publicar/index.ts`](supabase/functions/publicar/index.ts) e publique.
3. **Edge Functions → Secrets**: crie `GITHUB_TOKEN` (o token do item 1) e `GITHUB_REPO` com o valor `nonatoboy/km-bim-site`.

### 4. Segredos do GitHub

No repositório: **Settings → Secrets and variables → Actions → New repository secret**.

| Nome | Valor |
| --- | --- |
| `PUBLIC_SUPABASE_URL` | Project URL do passo 1.3 |
| `PUBLIC_SUPABASE_ANON_KEY` | chave anon public do passo 1.3 |
| `FTP_SERVER` | hPanel → Arquivos → Contas FTP → **Servidor FTP** (IP ou `ftp.kmbim.com.br`) |
| `FTP_USERNAME` | usuário FTP (mesma tela) |
| `FTP_PASSWORD` | senha FTP (mesma tela; redefina se não souber) |
| `FTP_SERVER_DIR` | opcional; padrão `./public_html/`. Use `./domains/kmbim.com.br/public_html/` se a conta FTP abrir na raiz da hospedagem |

### 5. Hostinger

- **Segurança → SSL**: confirme que o certificado de `kmbim.com.br` está ativo (o `.htaccess` força HTTPS).
- Se houver um site padrão da Hostinger em `public_html` (`default.php`), apague-o no Gerenciador de Arquivos.

### 6. Primeira publicação

GitHub → **Actions → Publicar site → Run workflow**. Em cerca de 2 minutos o site está no ar. A partir daí:

- cada commit na branch `main` publica automaticamente;
- o botão **Publicar alterações** no painel (`kmbim.com.br/admin`) publica depois de editar conteúdo.

Se o envio FTP falhar mesmo assim com erro de TLS, troque `protocol: ftps` por `protocol: ftp` em `.github/workflows/publicar.yml`.

## Desenvolvimento local

```bash
npm install
cp .env.example .env   # preencha com a URL e a chave anon; sem elas o site usa src/data/conteudo-inicial.json
npm run dev            # http://localhost:4321
npm run build          # gera dist/
```

`src/data/conteudo-inicial.json` é a carga inicial do banco: depois de alterá-lo, rode `npm run seed` para regenerar `supabase/seed.sql`. Depois que o site estiver no ar, o conteúdo vive no Supabase e é editado pelo painel.

## Estrutura

```
brand/                      logotipo, PNGs, fontes e manual da marca
public/                     arquivos servidos como estão (imagens, favicon, .htaccess)
src/pages/                  páginas do site (uma rota por arquivo)
src/layouts/Base.astro      cabeçalho, rodapé e metadados
src/components/             card de solução, barra de seleção, logo
src/lib/conteudo.ts         leitura do Supabase no build
src/scripts/carrinho.ts     seleção de soluções para o orçamento
src/scripts/admin.ts        painel administrativo
supabase/migrations/        estrutura do banco e regras de segurança
supabase/functions/         Edge Function "publicar"
.github/workflows/          build e envio para a Hostinger
```

## Próximas etapas

- Notificação de novos pedidos via n8n (webhook do Supabase em `pedidos_orcamento`).
- Depoimentos, fotos de palestras e publicações, conforme o material for liberado.
- Catálogo de cursos.
