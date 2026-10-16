// Edge Function "inscricao": confirma ou cancela uma inscrição a partir do link enviado por e-mail.
// Na confirmação, envia o link de acesso com convite de agenda (.ics) e avisa a KM BIM.
// Sem vagas, a confirmação coloca a pessoa na lista de espera; quando uma vaga é liberada
// (cancelamento, mudança no painel ou aumento de vagas), o primeiro da fila é confirmado e avisado.
// Pública (chamada pela página /eventos/confirmar): desligue "Verify JWT" ao publicar.
// A ação "promover" (painel) exige o login de um administrador, verificado aqui dentro.
//
// Segredos: RESEND_API_KEY, EMAIL_REMETENTE, EMAIL_RESPOSTA, SITE_URL (os mesmos da função "inscrever")
//           EMAIL_AVISO  endereço que recebe o aviso de nova inscrição confirmada (ex.: contato@kmbim.com.br)
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
const dataHora = (iso: string) => fmt(iso, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const hora = (iso: string) => fmt(iso, { hour: '2-digit', minute: '2-digit' });

function emailHtml(titulo: string, corpo: string) {
  const site = Deno.env.get('SITE_URL') ?? 'https://kmbim.com.br';
  return `<!doctype html><html><body style="margin:0;background:#EEF3F4;font-family:'Segoe UI',Arial,sans-serif;color:#1C2A31">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF3F4;padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden">
    <tr><td style="background:#1C2A31;padding:18px 24px;border-bottom:4px solid #F2A33A">
      <img src="${site}/img/email/km-bim-logo-email.png" width="150" alt="KM BIM Consultoria" style="display:block;background:#ffffff;border-radius:4px;padding:6px"></td></tr>
    <tr><td style="padding:28px 24px 8px"><h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:#0B5563">${titulo}</h1>${corpo}</td></tr>
    <tr><td style="padding:20px 24px;font-size:12px;color:#8A989D;border-top:1px solid #D6DFE1">
      KM Consultoria BIM Ltda · <a href="${site}" style="color:#0B5563">kmbim.com.br</a><br>
      Você recebeu este e-mail porque se inscreveu em um evento da KM BIM.</td></tr>
  </table></td></tr></table></body></html>`;
}

async function enviarEmail(para: string, assunto: string, html: string, anexos: { filename: string; content: string }[] = []) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('EMAIL_REMETENTE'), to: [para], reply_to: Deno.env.get('EMAIL_RESPOSTA'), subject: assunto, html,
      ...(anexos.length ? { attachments: anexos } : {}),
    }),
  });
  if (!resp.ok) throw new Error(`Resend ${resp.status}: ${await resp.text()}`);
}

// Convite de agenda (iCalendar), aceito por Outlook, Google Agenda e Apple Calendário.
function convite(ev: Record<string, string>, idInscricao: string) {
  const site = Deno.env.get('SITE_URL') ?? 'https://kmbim.com.br';
  const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const txt = (v: string) => v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const descricao = [ev.resumo, ev.link_acesso && `Acesso: ${ev.link_acesso}`, ev.instrucoes_acesso].filter(Boolean).join('\n\n');
  const linhas = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KM BIM//Eventos//PT', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${idInscricao}@kmbim.com.br`, `DTSTAMP:${utc(new Date().toISOString())}`,
    `DTSTART:${utc(ev.inicio)}`, `DTEND:${utc(ev.fim)}`,
    `SUMMARY:${txt(ev.titulo)}`, `DESCRIPTION:${txt(descricao)}`,
    `LOCATION:${txt(ev.link_acesso || ev.local)}`, `URL:${site}/eventos/${ev.slug}`,
    'ORGANIZER;CN=KM BIM Consultoria:mailto:contato@kmbim.com.br',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return btoa(unescape(encodeURIComponent(linhas.join('\r\n'))));
}

const CAMPOS_EVENTO = 'id, slug, titulo, resumo, inicio, fim, local, modalidade, link_acesso, instrucoes_acesso';
type Evento = Record<string, string>;
type Inscricao = { id: string; nome: string; email: string; telefone: string; empresa: string; token: string };
const site = () => Deno.env.get('SITE_URL') ?? 'https://kmbim.com.br';
const par = (t: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">${t}</p>`;
const nota = (t: string) => `<p style="margin:0 0 8px;font-size:13px;color:#56666D">${t}</p>`;

// E-mail com o link de acesso e o convite de agenda, e aviso para a KM BIM.
async function enviarConfirmacao(db: SupabaseClient, insc: Inscricao, ev: Evento, daEspera = false) {
  const cancelar = `${site()}/eventos/confirmar?token=${insc.token}&acao=cancelar`;
  const acesso = ev.link_acesso
    ? `<p style="margin:0 0 20px"><a href="${esc(ev.link_acesso)}" style="display:inline-block;background:#0B5563;color:#ffffff;font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:6px">Acessar o evento</a></p>
       <p style="margin:0 0 16px;font-size:13px;color:#56666D;word-break:break-all">Link: ${esc(ev.link_acesso)}</p>`
    : par('O link de acesso será enviado antes do evento.');
  const abertura = daEspera
    ? `Olá, ${esc(insc.nome.split(' ')[0])}! Boa notícia: uma vaga foi liberada e sua inscrição saiu da lista de espera. <strong>Sua vaga está garantida.</strong>`
    : `Olá, ${esc(insc.nome.split(' ')[0])}! Sua vaga está garantida.`;
  const corpo = `
    ${par(abertura)}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;font-size:15px;line-height:1.6">
      <tr><td style="padding:0 12px 4px 0;color:#56666D">Evento</td><td><strong>${esc(ev.titulo)}</strong></td></tr>
      <tr><td style="padding:0 12px 4px 0;color:#56666D">Quando</td><td>${esc(dataHora(ev.inicio))} às ${esc(hora(ev.fim))} (horário de Brasília)</td></tr>
      <tr><td style="padding:0 12px 4px 0;color:#56666D">Onde</td><td>${esc(ev.local)}</td></tr>
    </table>
    ${acesso}
    ${ev.instrucoes_acesso ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;white-space:pre-line">${esc(ev.instrucoes_acesso)}</p>` : ''}
    ${nota('O convite em anexo adiciona o evento à sua agenda.')}
    ${nota(`Não poderá participar? <a href="${cancelar}" style="color:#0B5563">Cancele sua inscrição</a> e libere a vaga${daEspera ? ' para o próximo da lista' : ''}.`)}`;
  try {
    await enviarEmail(insc.email, `${daEspera ? 'Vaga liberada! ' : ''}Inscrição confirmada: ${ev.titulo}`,
      emailHtml(daEspera ? 'Vaga liberada: inscrição confirmada' : 'Inscrição confirmada', corpo),
      [{ filename: 'evento-km-bim.ics', content: convite(ev, insc.id) }]);
  } catch (e) { console.error(e); }

  const aviso = Deno.env.get('EMAIL_AVISO');
  if (aviso) {
    const { count } = await db.from('inscricoes_evento').select('id', { count: 'exact', head: true }).eq('evento_id', ev.id).eq('status', 'confirmada');
    const corpoAviso = `${par(`<strong>${esc(insc.nome)}</strong> ${daEspera ? 'saiu da lista de espera e foi confirmado(a) em' : 'confirmou presença em'} <strong>${esc(ev.titulo)}</strong>.`)}
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6">${esc(insc.email)} · ${esc(insc.telefone)}${insc.empresa ? ` · ${esc(insc.empresa)}` : ''}</p>
      ${nota(`Confirmados até agora: ${count ?? '—'}`)}`;
    try {
      await enviarEmail(aviso, `${daEspera ? 'Lista de espera → confirmada' : 'Nova inscrição'}: ${ev.titulo}`,
        emailHtml(daEspera ? 'Inscrição promovida da lista de espera' : 'Nova inscrição confirmada', corpoAviso));
    } catch (e) { console.error(e); }
  }
}

// E-mail de quem entrou na lista de espera.
async function enviarListaEspera(insc: Inscricao, ev: Evento, posicao: number) {
  const cancelar = `${site()}/eventos/confirmar?token=${insc.token}&acao=cancelar`;
  const corpo = `
    ${par(`Olá, ${esc(insc.nome.split(' ')[0])}! As vagas de <strong>${esc(ev.titulo)}</strong> (${esc(dataHora(ev.inicio))}) estão preenchidas, e você está na <strong>lista de espera</strong>.`)}
    <p style="margin:4px 0 20px;font-size:15px">Sua posição: <strong style="font-size:22px;color:#0B5563">${posicao}º</strong></p>
    ${par('Se alguém desistir, a vaga passa automaticamente para o próximo da lista. Quando chegar a sua vez, você recebe um e-mail com a confirmação, o link de acesso e o convite para a agenda.')}
    ${nota(`Não tem mais interesse? <a href="${cancelar}" style="color:#0B5563">Saia da lista de espera</a>.`)}`;
  try {
    await enviarEmail(insc.email, `Você está na lista de espera (${posicao}º): ${ev.titulo}`, emailHtml('Você está na lista de espera', corpo));
  } catch (e) { console.error(e); }
}

// Preenche as vagas livres com a lista de espera e avisa cada pessoa confirmada. Retorna os ids promovidos.
async function promover(db: SupabaseClient, ev: Evento): Promise<string[]> {
  const { data: ids, error } = await db.rpc('promover_lista_espera', { p_evento: ev.id });
  if (error) { console.error(error); return []; }
  const lista = (ids ?? []) as string[];
  if (!lista.length) return [];
  const { data: pessoas } = await db.from('inscricoes_evento').select('id, nome, email, telefone, empresa, token').in('id', lista);
  for (const p of (pessoas ?? []) as Inscricao[]) await enviarConfirmacao(db, p, ev, true);
  return lista;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ erro: 'Método não permitido' }, 405);

  let d: Record<string, unknown>;
  try { d = await req.json(); } catch { return json({ resultado: 'invalido' }, 400); }
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Painel: preenche vagas livres com a lista de espera (após cancelar alguém ou aumentar as vagas).
  if (d.acao === 'promover') {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: usuario } = await db.auth.getUser(jwt);
    const { data: admin } = usuario?.user
      ? await db.from('administradores').select('user_id').eq('user_id', usuario.user.id).maybeSingle()
      : { data: null };
    if (!admin) return json({ erro: 'Acesso restrito ao administrador.' }, 403);
    const { data: ev } = await db.from('eventos').select(CAMPOS_EVENTO).eq('id', String(d.evento_id ?? '')).maybeSingle();
    if (!ev) return json({ erro: 'Evento não encontrado.' }, 404);
    const promovidos = await promover(db, ev as Evento);
    return json({ promovidos: promovidos.length });
  }

  const token = String(d.token ?? '');
  const acao = d.acao === 'cancelar' ? 'cancelar' : 'confirmar';
  if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ resultado: 'invalido' }, 400);

  const { data: insc } = await db.from('inscricoes_evento')
    .select(`id, nome, email, telefone, empresa, status, token, eventos(${CAMPOS_EVENTO})`)
    .eq('token', token).maybeSingle();
  if (!insc) return json({ resultado: 'invalido' }, 404);
  const ev = insc.eventos as unknown as Evento;
  const evento = { titulo: ev.titulo, slug: ev.slug, inicio: ev.inicio, fim: ev.fim, local: ev.local };
  const pessoa = insc as unknown as Inscricao;

  if (acao === 'cancelar') {
    if (insc.status === 'cancelada') return json({ resultado: 'cancelada', evento });
    const estava = insc.status;
    await db.from('inscricoes_evento').update({ status: 'cancelada', cancelado_em: new Date().toISOString() }).eq('id', insc.id);
    if (estava === 'confirmada') await promover(db, ev); // a vaga liberada vai para o primeiro da lista
    return json({ resultado: estava === 'lista_espera' ? 'saiu_espera' : 'cancelada', evento });
  }

  if (new Date(ev.fim).getTime() < Date.now()) return json({ resultado: 'encerrado', evento });
  const { data: resultado, error } = await db.rpc('confirmar_inscricao', { p_token: token });
  if (error) { console.error(error); return json({ resultado: 'erro' }, 500); }

  if (resultado === 'confirmada') {
    await enviarConfirmacao(db, pessoa, ev);
    return json({ resultado, evento });
  }
  if (resultado === 'lista_espera') {
    // Pode haver vaga livre (ex.: vagas aumentadas no painel): a fila anda antes de calcular a posição.
    const promovidos = await promover(db, ev);
    if (promovidos.includes(insc.id)) return json({ resultado: 'confirmada', evento });
    const { data: posicao } = await db.rpc('posicao_espera', { p_inscricao: insc.id });
    await enviarListaEspera(pessoa, ev, posicao ?? 1);
    return json({ resultado, evento, posicao });
  }
  if (resultado === 'ja_lista_espera') {
    const { data: posicao } = await db.rpc('posicao_espera', { p_inscricao: insc.id });
    return json({ resultado, evento, posicao });
  }
  return json({ resultado, evento });
});
