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

- **Páginas:** início, soluções (catálogo com seleção), detalhe de cada solução, eventos (lista, página com inscrição e confirmação), quem somos, solicitar orçamento, 404 e painel.
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
| `FTP_USERNAME` | `u386480918.ftpkm_bim`: conta FTP adicional, ligada à pasta publicada do domínio. **Não use** a conta principal `u386480918`: ela grava numa pasta que o site não serve |
| `FTP_PASSWORD` | senha FTP (mesma tela; redefina se não souber) |
| `FTP_SERVER_DIR` | opcional; padrão `./` (a conta FTP da Hostinger já abre dentro de `public_html`). Use o workflow **Diagnóstico FTP** para ver as pastas da conta |

### 5. Hostinger

- **Segurança → SSL**: confirme que o certificado de `kmbim.com.br` está ativo (o `.htaccess` força HTTPS).
- Se houver um site padrão da Hostinger em `public_html` (`default.php`), apague-o no Gerenciador de Arquivos.

### 6. Primeira publicação

GitHub → **Actions → Publicar site → Run workflow**. Em cerca de 2 minutos o site está no ar. A partir daí:

- cada commit na branch `main` publica automaticamente;
- o botão **Publicar alterações** no painel (`kmbim.com.br/admin`) publica depois de editar conteúdo.

### Envio manual (alternativa, se o envio automático falhar)

1. GitHub → **Actions** → execução mais recente de **Publicar site** → seção **Artifacts** → baixe **site-kmbim** (.zip).
2. hPanel → **Gerenciador de arquivos** → entre em **public_html** → selecione tudo e exclua.
3. **Upload → File** com o .zip → botão direito → **Extract** na própria `public_html` → apague o .zip.

O botão **Publicar alterações** do painel também gera esse .zip.

Se o envio FTP falhar mesmo assim com erro de TLS, troque `protocol: ftps` por `protocol: ftp` em `.github/workflows/publicar.yml`.

## Eventos (webinars, treinamentos, rodas de conversa)

Cada evento ganha uma página com formulário em `kmbim.com.br/eventos/{slug}`. A pessoa se inscreve, recebe um e-mail para **confirmar**, e só depois da confirmação recebe o **link de acesso** e o convite de agenda (.ics). As inscrições aparecem no painel, na aba **Inscrições**, com exportação para Excel.

### Configuração (uma vez)

1. **Banco:** no SQL Editor do Supabase, rode [`supabase/migrations/20261015000000_eventos.sql`](supabase/migrations/20261015000000_eventos.sql).
2. **Resend (envio de e-mails):**
   1. Crie a conta em https://resend.com (plano gratuito: 3.000 e-mails/mês).
   2. **Domains → Add Domain** → `eventos.kmbim.com.br` (subdomínio só para envio, região São Paulo). O Resend mostra os registros DNS: CNAME `rsend.eventos`, CNAME `send.eventos` e TXT `resend._domainkey.eventos`.
   3. No hPanel da Hostinger: **Domínios → kmbim.com.br → DNS / Nameservers** → adicione exatamente os registros mostrados (não é preciso criar o subdomínio no hPanel). Eles **não mexem** no e-mail da Microsoft.
   4. Volte ao Resend e clique em **Verify DNS Records** (o status fica *Not Started* até esse clique).
   5. **API Keys → Create API Key** (permissão *Sending access*, domínio `eventos.kmbim.com.br`). Copie a chave (`re_...`).
3. **Funções no Supabase** (Edge Functions → Deploy a new function → Via Editor), uma para cada arquivo:
   - nome `inscrever` → [`supabase/functions/inscrever/index.ts`](supabase/functions/inscrever/index.ts)
   - nome `inscricao` → [`supabase/functions/inscricao/index.ts`](supabase/functions/inscricao/index.ts)

   Nas duas, abra **Details/Settings** e **desligue "Verify JWT"**: elas são chamadas por visitantes do site e fazem as próprias validações.
4. **Segredos** (Edge Functions → Secrets):

   | Nome | Valor |
   | --- | --- |
   | `RESEND_API_KEY` | a chave `re_...` |
   | `EMAIL_REMETENTE` | `KM BIM Eventos <inscricoes@eventos.kmbim.com.br>` |
   | `EMAIL_RESPOSTA` | `contato@kmbim.com.br` |
   | `EMAIL_AVISO` | `contato@kmbim.com.br` (recebe aviso de cada inscrição confirmada) |
   | `SITE_URL` | `https://kmbim.com.br` |

5. Publique o site. O item **Eventos** aparece no menu.

### Uso
- **Criar evento:** painel → **Eventos → Adicionar**. O campo *Link de acesso* (sala do Teams) é privado: vai só no e-mail dos confirmados.
- **Divulgar:** use o link `kmbim.com.br/eventos/{slug}`.
- Cada evento novo precisa de **Publicar alterações** para a página existir. Inscrições, vagas e confirmações funcionam em tempo real, sem publicar.
- **Acompanhar:** painel → **Inscrições** → escolha o evento. Dá para mudar status, marcar presença e exportar para Excel.
- **Lista de espera:** com as vagas preenchidas, o formulário continua aberto e mostra a posição prevista na fila. Quem confirma o e-mail entra na lista de espera (e recebe a posição por e-mail). Quando uma vaga é liberada (a pessoa cancela pelo link do e-mail, você muda o status no painel para *Cancelada* ou aumenta as vagas do evento), o primeiro da fila é confirmado automaticamente e recebe o e-mail com o link de acesso e o convite. Migration: [`supabase/migrations/20261016000000_lista_espera.sql`](supabase/migrations/20261016000000_lista_espera.sql).
- **Evento exclusivo (não listado):** desmarque **Listado no site**. A página e as inscrições funcionam normalmente, mas o evento não aparece na lista de eventos nem na página inicial, e a página pede aos buscadores para não indexar. Só chega quem recebe o link. Migration: [`supabase/migrations/20261017000000_eventos_nao_listados.sql`](supabase/migrations/20261017000000_eventos_nao_listados.sql).
- **Eventos pagos:** o campo *Preço* já existe e aparece no site, mas o pagamento online ainda não está integrado; combine o pagamento por fora por enquanto.

### Convites individuais

Para eventos restritos: cada pessoa recebe um convite com **link pessoal** (`/eventos/{slug}?c=…`), por e-mail (enviado pelo site) ou por WhatsApp (você envia um a um, com a mensagem pronta). O painel, na aba **Convites**, mostra quem recebeu, quem abriu, quais e-mails são inválidos, quem abriu o link e quem se inscreveu.

**Configuração (uma vez)**

1. **Banco:** no SQL Editor, rode [`supabase/migrations/20261018000000_convites.sql`](supabase/migrations/20261018000000_convites.sql).
2. **Função nova** (Edge Functions → Deploy a new function → Via Editor): nome `convites` → [`supabase/functions/convites/index.ts`](supabase/functions/convites/index.ts). Em **Details/Settings**, **desligue "Verify JWT"** (o retorno do Resend não tem login; o painel é verificado dentro da função).
3. **Atualize a função `inscrever`** com o conteúdo atual de [`supabase/functions/inscrever/index.ts`](supabase/functions/inscrever/index.ts) (abra a função → Code → cole → Deploy). Assim a inscrição feita pelo link pessoal fica ligada ao convidado.
4. **Retorno do Resend (webhook):** no Resend, **Webhooks → Add Endpoint**:
   - Endpoint URL: `https://SEU-PROJETO.supabase.co/functions/v1/convites` (a mesma Project URL do passo 1 da configuração, com `/functions/v1/convites` no fim)
   - Eventos: `email.delivered`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`, `email.failed`
   - Depois de criar, copie o **Signing Secret** (`whsec_…`) e adicione em Supabase → Edge Functions → Secrets como `RESEND_WEBHOOK_SECRET`.
5. **Opcional, para saber quem abriu o e-mail:** Resend → **Domains → eventos.kmbim.com.br → Configuration → Open Tracking** ligado. (Não é preciso ligar o *Click Tracking*: o próprio site registra quem abriu o link pessoal.)

**Uso**

1. Painel → **Convites** → escolha o evento.
2. **Importar:** copie do Excel as colunas Nome, E-mail e Celular (em qualquer ordem) e cole. E-mail e celular são opcionais: quem tiver só celular fica para o WhatsApp, e quem tiver só o nome recebe a mensagem copiada (LinkedIn). Dá para copiar a lista de outro evento.
3. **Textos:** ajuste o assunto, o e-mail e a mensagem de WhatsApp (`{nome}`, `{titulo}`, `{tipo}`, `{data}`, `{local}`, `{resumo}`, `{palestrante}`, `{quem}`, `{link}`), salve e clique em **Enviar convite de teste para mim**.
4. **Enviar convites por e-mail:** até 80 por dia (o plano gratuito do Resend permite 100 e-mails por dia, e a folga fica para as confirmações de inscrição). O restante fica pendente: clique de novo no dia seguinte. Para mudar o limite, crie o segredo `LIMITE_DIARIO_CONVITES`.
5. **WhatsApp e LinkedIn:** filtro *Mensagem a enviar*. **WhatsApp** abre a conversa com a mensagem pronta (e também a copia); **Copiar convite** copia a mensagem, sem os asteriscos de negrito, para colar no LinkedIn ou em outra rede. Nos dois casos o painel marca o envio.
6. **E-mails inválidos** aparecem como *Inválido*: corrija o endereço na própria linha (ele volta para "não enviado") ou use o WhatsApp.
7. **Lembrete:** um clique envia um lembrete único para quem recebeu o convite há pelo menos 1 dia e ainda não se inscreveu.
8. Depois do evento, use **Apagar a lista deste evento** se não for reaproveitá-la (dados pessoais: guarde só o necessário).

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
