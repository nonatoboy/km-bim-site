// Edge Function "convites": envia os convites individuais de um evento e recebe o retorno do Resend.
// - Painel (login de administrador, verificado aqui dentro), ações:
//     "enviar"   convites ainda não enviados (ou que deram erro), até o limite do dia
//     "lembrete" para quem recebeu o convite há 1 dia ou mais e ainda não se inscreveu (uma vez por pessoa)
//     "teste"    um exemplo do convite ou do lembrete para o e-mail do próprio administrador
// - Webhook do Resend (assinado): marca entregue, aberto, clicou, devolvido (e-mail inválido) ou spam.
// Desligue "Verify JWT" ao publicar: o webhook não tem login.
//
// Segredos: RESEND_API_KEY, EMAIL_REMETENTE, EMAIL_RESPOSTA, SITE_URL (os mesmos das outras funções)
//           RESEND_WEBHOOK_SECRET   Resend > Webhooks > Signing secret (começa com whsec_)
//           LIMITE_DIARIO_CONVITES  opcional, padrão 80. O plano gratuito do Resend envia 100 e-mails por dia,
//                                   contando as confirmações de inscrição; a folga fica para elas.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', ...o }).format(new Date(iso));
const dataHora = (iso: string) => fmt(iso, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).replace(' às ', ', às ');
const dataCurta = (iso: string) => fmt(iso, { day: '2-digit', month: '2-digit' });
const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? '';

const CAMPOS_EVENTO = 'id, slug, titulo, resumo, inicio, fim, local, palestrante, vagas, convite_assunto, convite_texto';
interface Evento { id: string; slug: string; titulo: string; resumo: string; inicio: string; fim: string; local: string; palestrante: string; vagas: number | null; convite_assunto: string; convite_texto: string }
interface Convidado { id: string; nome: string; email: string; token: string }

const TEXTO_PADRAO = `Olá, {nome}!

Quero convidar você para {titulo}, {data}, pelo {local}.

{resumo}

O convite é pessoal e as vagas são limitadas. Para garantir a sua, inscreva-se pelo link:

{link}

Um abraço,
{palestrante}`;

function emailHtml(corpo: string, rodape: string) {
  const site = Deno.env.get('SITE_URL') ?? 'https://kmbim.com.br';
  return `<!doctype html><html><body style="margin:0;background:#EEF3F4;font-family:'Segoe UI',Arial,sans-serif;color:#1C2A31">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF3F4;padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden">
    <tr><td style="background:#1C2A31;padding:18px 24px;border-bottom:4px solid #F2A33A">
      <img src="${site}/img/email/km-bim-logo-email.png" width="150" alt="KM BIM Consultoria" style="display:block;background:#ffffff;border-radius:4px;padding:6px"></td></tr>
    <tr><td style="padding:28px 24px 8px">${corpo}</td></tr>
    <tr><td style="padding:20px 24px;font-size:12px;color:#8A989D;border-top:1px solid #D6DFE1">
      KM Consultoria BIM Ltda · <a href="${site}" style="color:#0B5563">kmbim.com.br</a><br>${rodape}</td></tr>
  </table></td></tr></table></body></html>`;
}

const par = (t: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${t}</p>`;
const botao = (link: string, texto: string) =>
  `<p style="margin:8px 0 22px"><a href="${link}" style="display:inline-block;background:#F2A33A;color:#1C2A31;font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:6px">${texto}</a></p>`;

// Texto do painel → HTML. Parágrafos separados por linha em branco; um parágrafo só com {link} vira botão.
function textoParaHtml(texto: string, valores: Record<string, string>, link: string) {
  const trocar = (s: string) => s.replace(/\{(\w+)\}/g, (m, k) => (k === 'link' ? '\u0000' : valores[k] ?? m));
  let temLink = false;
  const blocos = texto.trim().split(/\n\s*\n/).map((bloco) => {
    if (bloco.trim() === '{link}') { temLink = true; return botao(link, 'Garantir minha vaga'); }
    const html = esc(trocar(bloco)).replace(/\n/g, '<br>');
    if (html.includes('\u0000')) temLink = true;
    return par(html.replace(/\u0000/g, `<a href="${link}" style="color:#0B5563">${esc(link)}</a>`));
  });
  if (!temLink) blocos.push(botao(link, 'Garantir minha vaga'));
  return blocos.join('');
}

function remetente(ev: Evento) {
  const base = Deno.env.get('EMAIL_REMETENTE') ?? '';
  const endereco = base.match(/<([^>]+)>/)?.[1] ?? base;
  const nome = `${ev.palestrante || 'KM BIM'} | KM BIM`.replace(/"/g, '');
  return `"${nome}" <${endereco}>`;
}

function montarConvite(ev: Evento, nome: string, link: string) {
  const valores = {
    nome: primeiroNome(nome), titulo: ev.titulo, data: dataHora(ev.inicio), local: ev.local || 'Microsoft Teams',
    resumo: ev.resumo ?? '', palestrante: ev.palestrante ?? '',
  };
  const assunto = (ev.convite_assunto || 'Convite: {titulo}').replace(/\{(\w+)\}/g, (m, k) => (valores as Record<string, string>)[k] ?? m);
  const corpo = textoParaHtml(ev.convite_texto || TEXTO_PADRAO, valores, link);
  const rodape = `Este é um convite pessoal de ${esc(ev.palestrante || 'KM BIM')}. Se não quiser receber outros convites, responda este e-mail.`;
  return { assunto, html: emailHtml(corpo, rodape) };
}

function montarLembrete(ev: Evento, nome: string, link: string, vagas: number | null) {
  const situacao = vagas === null ? ''
    : vagas > 0 ? par(`Ainda ${vagas === 1 ? 'há 1 vaga' : `há ${vagas} vagas`}.`)
    : par('As vagas foram preenchidas, mas a lista de espera está aberta: se alguém desistir, o próximo da fila é chamado automaticamente.');
  const corpo = `
    ${par(`Olá, ${esc(primeiroNome(nome))}!`)}
    ${par(`Passando para lembrar do convite para <strong>${esc(ev.titulo)}</strong>, ${esc(dataHora(ev.inicio))}, pelo ${esc(ev.local || 'Microsoft Teams')}.`)}
    ${situacao}
    ${botao(link, vagas === 0 ? 'Entrar na lista de espera' : 'Garantir minha vaga')}
    ${par(`Um abraço,<br>${esc(ev.palestrante ?? '')}`)}`;
  const rodape = `Este é um convite pessoal de ${esc(ev.palestrante || 'KM BIM')}. Se não quiser receber outros convites, responda este e-mail.`;
  return { assunto: `Lembrete: ${ev.titulo}, ${dataCurta(ev.inicio)}`, html: emailHtml(corpo, rodape) };
}

// Até 100 e-mails por chamada (limite do Resend). Retorna o id de cada e-mail, na mesma ordem.
async function enviarLote(emails: Record<string, unknown>[]): Promise<string[]> {
  const resp = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(emails),
  });
  if (!resp.ok) throw new Error(`Resend ${resp.status}: ${await resp.text()}`);
  const { data } = await resp.json();
  return (data ?? []).map((d: { id: string }) => d.id);
}

const linkPessoal = (ev: Evento, token: string) => `${Deno.env.get('SITE_URL') ?? 'https://kmbim.com.br'}/eventos/${ev.slug}?c=${token}`;

// Envios de convites e lembretes desde a meia-noite de hoje (Brasília, UTC-3).
async function enviadosHoje(db: SupabaseClient) {
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const inicio = `${hoje}T00:00:00-03:00`;
  const [a, b] = await Promise.all([
    db.from('convidados').select('id', { count: 'exact', head: true }).gte('email_enviado_em', inicio),
    db.from('convidados').select('id', { count: 'exact', head: true }).gte('lembrete_enviado_em', inicio),
  ]);
  return (a.count ?? 0) + (b.count ?? 0);
}

async function enviar(db: SupabaseClient, ev: Evento, tipo: 'convite' | 'lembrete') {
  const limite = Number(Deno.env.get('LIMITE_DIARIO_CONVITES') ?? 80);
  const usados = await enviadosHoje(db);
  const cota = Math.max(limite - usados, 0);

  let pessoas: Convidado[] = [];
  let vagas: number | null = null;
  if (tipo === 'convite') {
    const { data } = await db.from('convidados').select('id, nome, email, token')
      .eq('evento_id', ev.id).neq('email', '').in('email_status', ['pendente', 'erro']).order('criado_em');
    pessoas = (data ?? []) as Convidado[];
  } else {
    const [{ data }, { data: insc }, { data: restantes }] = await Promise.all([
      db.from('convidados').select('id, nome, email, token')
        .eq('evento_id', ev.id).neq('email', '').in('email_status', ['enviado', 'entregue', 'aberto', 'clicou'])
        .is('lembrete_enviado_em', null).lt('email_enviado_em', new Date(Date.now() - 24 * 3600_000).toISOString()) // convite com 1 dia ou mais
        .order('criado_em'),
      db.from('inscricoes_evento').select('email, convidado_id').eq('evento_id', ev.id),
      db.rpc('vagas_restantes', { p_evento: ev.id }),
    ]);
    // Quem já se inscreveu (ou se inscreveu e cancelou) não recebe lembrete.
    const emails = new Set((insc ?? []).map((i) => String(i.email).toLowerCase()));
    const ids = new Set((insc ?? []).map((i) => i.convidado_id).filter(Boolean));
    pessoas = ((data ?? []) as Convidado[]).filter((p) => !ids.has(p.id) && !emails.has(p.email.toLowerCase()));
    vagas = typeof restantes === 'number' ? restantes : null;
  }

  const agora = pessoas.slice(0, cota);
  let enviados = 0;
  let falhas = 0;
  const responder = Deno.env.get('EMAIL_RESPOSTA');
  for (let i = 0; i < agora.length; i += 100) {
    const lote = agora.slice(i, i + 100);
    const emails = lote.map((p) => {
      const m = tipo === 'convite' ? montarConvite(ev, p.nome, linkPessoal(ev, p.token)) : montarLembrete(ev, p.nome, linkPessoal(ev, p.token), vagas);
      return {
        from: remetente(ev), to: [p.email], reply_to: responder, subject: m.assunto, html: m.html,
        headers: responder ? { 'List-Unsubscribe': `<mailto:${responder}?subject=Nao%20quero%20receber%20convites>` } : undefined,
      };
    });
    const quando = new Date().toISOString();
    try {
      const ids = await enviarLote(emails);
      await Promise.all(lote.map((p, j) => db.from('convidados').update(tipo === 'convite'
        ? { email_status: 'enviado', email_id: ids[j] ?? null, email_enviado_em: quando, email_erro: '' }
        : { lembrete_id: ids[j] ?? null, lembrete_enviado_em: quando }).eq('id', p.id)));
      enviados += lote.length;
    } catch (e) {
      console.error(e);
      if (tipo === 'convite') {
        await db.from('convidados').update({ email_status: 'erro', email_erro: String(e).slice(0, 300) }).in('id', lote.map((p) => p.id));
      }
      falhas += lote.length;
    }
  }
  return { enviados, falhas, restantes: pessoas.length - enviados, limite, usados_hoje: usados + enviados };
}

// ---------------------------------------------------------------- webhook do Resend (assinatura Svix)
async function assinaturaValida(req: Request, corpo: string) {
  const segredo = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? '';
  const id = req.headers.get('svix-id');
  const ts = req.headers.get('svix-timestamp');
  const assinaturas = req.headers.get('svix-signature');
  if (!segredo || !id || !ts || !assinaturas) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const chave = Uint8Array.from(atob(segredo.replace(/^whsec_/, '')), (c) => c.charCodeAt(0));
  const k = await crypto.subtle.importKey('raw', chave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${id}.${ts}.${corpo}`)));
  const esperado = btoa(String.fromCharCode(...sig));
  return assinaturas.split(' ').some((a) => a.split(',')[1] === esperado);
}

const NIVEL: Record<string, number> = { pendente: 0, erro: 0, enviado: 1, entregue: 2, aberto: 3, clicou: 4 };
const EVENTOS_RESEND: Record<string, string> = {
  'email.delivered': 'entregue', 'email.opened': 'aberto', 'email.clicked': 'clicou',
  'email.bounced': 'devolvido', 'email.complained': 'spam', 'email.failed': 'erro',
};

async function webhook(db: SupabaseClient, evento: { type?: string; data?: Record<string, any> }) {
  const novo = EVENTOS_RESEND[evento.type ?? ''];
  const idEmail = String(evento.data?.email_id ?? '').replace(/[^0-9a-f-]/gi, '');
  if (!novo || !idEmail) return;
  const { data: c } = await db.from('convidados').select('id, email_status')
    .or(`email_id.eq.${idEmail},lembrete_id.eq.${idEmail}`).maybeSingle();
  if (!c) return;
  const atual = c.email_status as string;
  if (atual === 'devolvido' || atual === 'spam') return; // definitivos
  const definitivo = novo === 'devolvido' || novo === 'spam';
  if (novo === 'erro' && atual !== 'enviado') return; // falha tardia só importa se nada mais chegou
  if (!definitivo && novo !== 'erro' && NIVEL[novo] <= (NIVEL[atual] ?? 0)) return;
  const motivo = novo === 'devolvido' ? String(evento.data?.bounce?.message ?? 'Endereço inválido ou caixa inexistente') : '';
  await db.from('convidados').update({ email_status: novo, ...(motivo ? { email_erro: motivo.slice(0, 300) } : {}) }).eq('id', c.id);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ erro: 'Método não permitido' }, 405);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const corpo = await req.text();

  // Webhook do Resend
  if (req.headers.get('svix-id')) {
    if (!(await assinaturaValida(req, corpo))) return json({ erro: 'Assinatura inválida' }, 401);
    try { await webhook(db, JSON.parse(corpo)); } catch (e) { console.error(e); }
    return json({ ok: true });
  }

  // Painel: só administrador
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: usuario } = await db.auth.getUser(jwt);
  const { data: admin } = usuario?.user
    ? await db.from('administradores').select('user_id').eq('user_id', usuario.user.id).maybeSingle()
    : { data: null };
  if (!admin) return json({ erro: 'Acesso restrito ao administrador.' }, 403);

  let d: Record<string, unknown>;
  try { d = JSON.parse(corpo); } catch { return json({ erro: 'Dados inválidos' }, 400); }
  const { data: ev } = await db.from('eventos').select(CAMPOS_EVENTO).eq('id', String(d.evento_id ?? '')).maybeSingle();
  if (!ev) return json({ erro: 'Evento não encontrado.' }, 404);

  if (d.acao === 'teste') {
    const para = usuario!.user!.email;
    if (!para) return json({ erro: 'Seu usuário não tem e-mail.' }, 400);
    const site = Deno.env.get('SITE_URL') ?? 'https://kmbim.com.br';
    const link = `${site}/eventos/${ev.slug}`; // sem token: o teste não marca ninguém
    const nome = primeiroNome(ev.palestrante || 'Marcelo');
    const { data: restantes } = await db.rpc('vagas_restantes', { p_evento: ev.id });
    const m = d.tipo === 'lembrete'
      ? montarLembrete(ev as Evento, nome, link, typeof restantes === 'number' ? restantes : null)
      : montarConvite(ev as Evento, nome, link);
    try {
      await enviarLote([{ from: remetente(ev as Evento), to: [para], reply_to: Deno.env.get('EMAIL_RESPOSTA'), subject: `[Teste] ${m.assunto}`, html: m.html }]);
    } catch (e) { console.error(e); return json({ erro: 'O Resend recusou o envio. Veja os logs da função.' }, 502); }
    return json({ ok: true, para });
  }
  if (d.acao === 'enviar' || d.acao === 'lembrete') {
    return json(await enviar(db, ev as Evento, d.acao === 'enviar' ? 'convite' : 'lembrete'));
  }
  return json({ erro: 'Ação desconhecida' }, 400);
});
