---
name: criar-evento
description: Planeja e prepara um evento da KM BIM (webinar, treinamento, roda de conversa, workshop) do zero até a divulgação. Conduz a conversa com o Marcelo, redige título, resumo, descrição e público-alvo, gera as artes (site, feed e stories), escreve os textos de divulgação (LinkedIn, WhatsApp, e-mail) e entrega a ficha pronta para cadastrar no painel kmbim.com.br/admin. Use quando o pedido for criar, planejar, divulgar ou revisar um evento.
---

# Criar evento KM BIM

O usuário é **Marcelo Nonato Santos**, sócio-diretor da **KM Consultoria BIM Ltda** (marca **KM BIM**, tagline *"Conhecimento que constrói."*). Ele fala português do Brasil e não é programador: oriente passo a passo, em linguagem simples, sem jargão de código. Cada evento ganha a página `kmbim.com.br/eventos/{slug}` com formulário de inscrição, confirmação por e-mail, lista de espera automática e envio do link de acesso. A parte técnica já está pronta (ver `CLAUDE.md` e a seção "Eventos" do `README.md`); **este fluxo não altera o código do site**, a não ser que o Marcelo peça.

## Etapa 1 · Entender o evento

Pergunte de uma vez só (com sugestões, para ele só confirmar), e siga com padrões sensatos no que ele não souber:

1. **Tema e objetivo**: o que o participante leva ao final?
2. **Tipo**: webinar, treinamento, roda de conversa, workshop ou outro.
3. **Data, horário de início e duração** (horário de Brasília). Padrão: 1h para webinar, 19h.
4. **Modalidade e local**: online (padrão: Microsoft Teams), presencial (endereço) ou híbrido.
5. **Vagas**: número ou sem limite. Com limite, a lista de espera funciona sozinha.
6. **Preço**: padrão gratuito. Pagamento online ainda não existe; se for pago, avise que a cobrança é combinada por fora.
7. **Público**: quem deve vir (cargos, porte da empresa, nível de BIM).
8. **Quem conduz**: padrão "Marcelo Nonato Santos"; convidados, se houver.
9. **Solução relacionada** (opcional): escolha entre os slugs de `solucoes` em `src/data/conteudo-inicial.json` (o painel pode ter soluções mais novas; confirme com ele).
10. **Prazo de inscrição** (opcional): padrão até o início do evento.

O link da sala do Teams **não** precisa ser passado aqui: ele vai direto no painel (campo privado). Nunca grave esse link no repositório.

## Etapa 2 · Redigir o conteúdo

Tom da marca: consultivo, próximo, técnico sem pedantismo, inovador sem exagero. Frases curtas, foco no benefício prático para escritórios e construtoras de pequeno e médio porte. Sem promessas vagas ("revolucione"), sem emoji no texto do site, sem caixa alta em frases inteiras. A KM BIM atua em BIM na AEC (projeto, obra, gestão de dados, ISO 19650, sistemas como diferencial); o Marcelo é engenheiro civil pela Poli-USP, 30+ anos na construção, palestrante em três edições da Autodesk University. **Não cite clientes nem empresas onde ele trabalhou.**

Entregue, para aprovação:

| Campo | Regra |
|---|---|
| **Título** | Até ~60 caracteres; diz o tema e o ganho. Ex.: "ISO 19650 na prática: por onde começar". |
| **Slug** | Minúsculas, números e hífens; curto e legível (vira o link de divulgação). Não pode ser `confirmar`. |
| **Subtítulo da arte** | Uma linha que complementa o título (só na arte). |
| **Resumo** | 1 ou 2 frases, até ~160 caracteres (lista de eventos e compartilhamento). |
| **Descrição completa** | 3 a 5 parágrafos curtos, separados por linha em branco: contexto/problema → o que será apresentado (pode listar 3 a 5 tópicos em frases) → formato (duração, perguntas ao vivo, material) → convite. |
| **Para quem é** | 1 parágrafo ou frase listando os perfis. |
| **Instruções para os confirmados** | Vai no e-mail com o link: chegar 5 min antes, material prévio, se terá gravação, certificado etc. |

Revise com ele e ajuste até aprovar.

## Etapa 3 · Gerar as artes

1. Crie `brand/eventos/{slug}/evento.json` (use `brand/eventos/exemplo/evento.json` como modelo):
   ```json
   { "slug": "…", "tipo": "webinar", "titulo": "…", "subtitulo": "…",
     "inicio": "2026-11-12T19:00:00-03:00", "fim": "2026-11-12T20:00:00-03:00",
     "local": "Microsoft Teams", "palestrante": "Marcelo Nonato Santos", "preco": null }
   ```
   Datas sempre com `-03:00` (Brasília). `preco` nulo ou 0 = "Gratuito".
2. Rode: `node brand/scripts/gerar-arte-evento.cjs brand/eventos/{slug}/evento.json`
   - Se faltar o módulo `playwright`: `NODE_PATH=$(npm root -g) node …` ou `npm install --no-save playwright` (o Chromium já vem instalado no ambiente; não rode `playwright install`). Se faltar `node_modules/@fontsource`, rode `npm install`.
3. Gera `arte-site.png` (1200×627, vai no campo **Arte de divulgação** do painel e serve para post), `arte-quadrada.png` (1080×1080, feed) e `arte-stories.png` (1080×1920).
4. Abra as três imagens e confira: título sem corte, data e horário certos, link certo. Títulos longos: encurte o título ou o subtítulo (não mexa no layout sem necessidade).
5. Envie as imagens ao Marcelo (SendUserFile) para ele baixar.

## Etapa 4 · Textos de divulgação

Salve em `brand/eventos/{slug}/divulgacao.md` e mostre no chat:

- **Post do LinkedIn (perfil do Marcelo)**: 1ª pessoa, gancho na primeira linha (um problema real do público), 3 a 5 linhas de valor, data/horário/formato, chamada com o link `kmbim.com.br/eventos/{slug}`, 3 a 5 hashtags (#BIM #ISO19650 #AEC #ConstruçãoCivil…). Até ~1.300 caracteres. Sugira postar com `arte-site.png` ou `arte-quadrada.png`.
- **Post da página KM BIM no LinkedIn** (linkedin.com/company/km-consultoria-bim): mesma informação, voz institucional ("a KM BIM promove…"), mais curto.
- **Mensagem de WhatsApp**: 4 a 6 linhas, direta, com link. Opcional: emojis discretos (📅 🕖 🔗).
- **E-mail-convite curto** para a rede de contatos (assunto + corpo de até 120 palavras), para ele enviar pelo Outlook.
- **Lembrete** para repostar 1 ou 2 dias antes ("últimas vagas" se houver limite).

## Etapa 5 · Ficha para o painel

Entregue uma tabela na ordem exata dos campos do painel (`kmbim.com.br/admin` → **Eventos → Adicionar**), com o valor de cada um pronto para copiar:

Título · Endereço (slug) · Tipo · Modalidade · Início (dd/mm/aaaa hh:mm) · Término · Local · Resumo · Descrição completa · Para quem é · Quem conduz · Vagas · Inscrições até · Inscrições abertas (marcado) · Preço (R$) · Link de acesso (privado: *cole a sala do Teams*) · Instruções para os confirmados · Arte de divulgação (*envie arte-site.png*) · Solução relacionada (slug) · Visível no site (marcado).

Depois oriente: **Salvar → Publicar alterações → aguardar ~2 min → abrir `kmbim.com.br/eventos/{slug}`** e conferir a página. Sugira que ele faça uma inscrição de teste com `seuemail+teste@gmail.com` e depois a cancele pelo link do e-mail.

Como criar a sala no Teams (se ele pedir): Teams → Calendário → **Nova reunião** (ou **Webinar**, se o plano permitir) → título e horário do evento → salvar → abrir a reunião → copiar o **link da reunião**. Para muitos participantes externos, recomende ativar a sala de espera (lobby) e desligar o microfone dos participantes ao entrar.

## Etapa 6 · Antes, durante e depois

- **Acompanhar**: painel → **Inscrições** → escolher o evento (confirmados, lista de espera com posição, pendentes). Vaga liberada ou aumento de vagas confirma automaticamente o primeiro da fila e envia o e-mail.
- **Mudar data/horário**: edite no painel e publique; os inscritos **não** são avisados automaticamente; redija um e-mail de aviso para ele mandar (exportar CSV → copiar e-mails em Cco).
- **No dia**: lembrar de abrir a sala 10 min antes; marcar **Presente** no painel depois (pode usar o relatório de presença do Teams).
- **Depois**: redija o e-mail de agradecimento (com gravação/material, se houver) e um post de resultado no LinkedIn. Desmarque **Inscrições abertas** se quiser; o site já move o evento para "Eventos anteriores" sozinho.

## Etapa 7 · Salvar no repositório

Faça commit de `brand/eventos/{slug}/` (evento.json, artes, divulgacao.md) na branch `main`, autor `Marcelo Nonato Santos <nonatoboy@gmail.com>`, mensagem em português (ex.: "Evento: artes e divulgação de {título}"). O push na `main` dispara a publicação do site, o que é inofensivo. Nunca inclua o link do Teams, senhas ou chaves nos arquivos.

## Cuidados

- Nunca peça nem aceite no chat a chave *service_role* do Supabase, a chave do Resend ou senhas.
- Datas: sempre confirme dia da semana + data + horário de Brasília por extenso antes de gerar as artes.
- Se ele pedir algo que exige mudança no site (novo campo, novo e-mail automático, certificado), explique o que mudaria e só altere o código depois do "ok", seguindo o `CLAUDE.md`.
