// Edge Function "inscricao": confirma ou cancela uma inscrição a partir do link enviado por e-mail.
// Na confirmação, envia o link de acesso com convite de agenda (.ics) e avisa a KM BIM.
// Pública (chamada pela página /eventos/confirmar): desligue "Verify JWT" ao publicar.
//
// Segredos: RESEND_API_KEY, EMAIL_REMETENTE, EMAIL_RESPOSTA, SITE_URL (os mesmos da função "inscrever")
//           EMAIL_AVISO  endereço que recebe o aviso de nova inscrição confirmada (ex.: contato@kmbim.com.br)
import { createClient } from 'npm:@supabase/supabase-js@2';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ erro: 'Método não permitido' }, 405);

  let d: Record<string, unknown>;
  try { d = await req.json(); } catch { return json({ resultado: 'invalido' }, 400); }
  const token = String(d.token ?? '');
  const acao = d.acao === 'cancelar' ? 'cancelar' : 'confirmar';
  if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ resultado: 'invalido' }, 400);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: insc } = await db.from('inscricoes_evento')
    .select('id, nome, email, telefone, empresa, status, eventos(id, slug, titulo, resumo, inicio, fim, local, modalidade, link_acesso, instrucoes_acesso)')
    .eq('token', token).maybeSingle();
  if (!insc) return json({ resultado: 'invalido' }, 404);
  const ev = insc.eventos as unknown as Record<string, string>;
  const evento = { titulo: ev.titulo, slug: ev.slug, inicio: ev.inicio, fim: ev.fim, local: ev.local };

  if (acao === 'cancelar') {
    if (insc.status !== 'cancelada') {
      await db.from('inscricoes_evento').update({ status: 'cancelada', cancelado_em: new Date().toISOString() }).eq('id', insc.id);
    }
    return json({ resultado: 'cancelada', evento });
  }

  if (new Date(ev.fim).getTime() < Date.now()) return json({ resultado: 'encerrado', evento });
  const { data: resultado, error } = await db.rpc('confirmar_inscricao', { p_token: token });
  if (error) { console.error(error); return json({ resultado: 'erro' }, 500); }
  if (resultado !== 'confirmada') return json({ resultado, evento });

  const site = Deno.env.get('SITE_URL') ?? 'https://kmbim.com.br';
  const cancelar = `${site}/eventos/confirmar?token=${token}&acao=cancelar`;
  const acesso = ev.link_acesso
    ? `<p style="margin:0 0 20px"><a href="${esc(ev.link_acesso)}" style="display:inline-block;background:#0B5563;color:#ffffff;font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:6px">Acessar o evento</a></p>
       <p style="margin:0 0 16px;font-size:13px;color:#56666D;word-break:break-all">Link: ${esc(ev.link_acesso)}</p>`
    : `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">O link de acesso será enviado antes do evento.</p>`;
  const corpo = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Olá, ${esc(insc.nome.split(' ')[0])}! Sua vaga está garantida.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;font-size:15px;line-height:1.6">
      <tr><td style="padding:0 12px 4px 0;color:#56666D">Evento</td><td><strong>${esc(ev.titulo)}</strong></td></tr>
      <tr><td style="padding:0 12px 4px 0;color:#56666D">Quando</td><td>${esc(dataHora(ev.inicio))} às ${esc(hora(ev.fim))} (horário de Brasília)</td></tr>
      <tr><td style="padding:0 12px 4px 0;color:#56666D">Onde</td><td>${esc(ev.local)}</td></tr>
    </table>
    ${acesso}
    ${ev.instrucoes_acesso ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;white-space:pre-line">${esc(ev.instrucoes_acesso)}</p>` : ''}
    <p style="margin:0 0 8px;font-size:13px;color:#56666D">O convite em anexo adiciona o evento à sua agenda.</p>
    <p style="margin:0 0 8px;font-size:13px;color:#56666D">Não poderá participar? <a href="${cancelar}" style="color:#0B5563">Cancele sua inscrição</a> e libere a vaga.</p>`;
  try {
    await enviarEmail(insc.email, `Inscrição confirmada: ${ev.titulo}`, emailHtml('Inscrição confirmada', corpo),
      [{ filename: 'evento-km-bim.ics', content: convite(ev, insc.id) }]);
  } catch (e) { console.error(e); }

  const aviso = Deno.env.get('EMAIL_AVISO');
  if (aviso) {
    const { count } = await db.from('inscricoes_evento').select('id', { count: 'exact', head: true }).eq('evento_id', ev.id).eq('status', 'confirmada');
    const corpoAviso = `<p style="margin:0 0 12px;font-size:15px;line-height:1.6"><strong>${esc(insc.nome)}</strong> confirmou presença em <strong>${esc(ev.titulo)}</strong>.</p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6">${esc(insc.email)} · ${esc(insc.telefone)}${insc.empresa ? ` · ${esc(insc.empresa)}` : ''}</p>
      <p style="margin:0 0 12px;font-size:14px;color:#56666D">Confirmados até agora: ${count ?? '—'}</p>`;
    try { await enviarEmail(aviso, `Nova inscrição: ${ev.titulo}`, emailHtml('Nova inscrição confirmada', corpoAviso)); } catch (e) { console.error(e); }
  }
  return json({ resultado: 'confirmada', evento });
});
