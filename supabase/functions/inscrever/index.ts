// Edge Function "inscrever": recebe a inscrição de um evento e envia o e-mail com o link de confirmação.
// Pública (chamada pelo formulário do site): desligue "Verify JWT" ao publicar.
//
// Segredos (Supabase > Edge Functions > Secrets):
//   RESEND_API_KEY   chave da API do Resend
//   EMAIL_REMETENTE  KM BIM Eventos <eventos@kmbim.com.br>
//   EMAIL_RESPOSTA   contato@kmbim.com.br
//   SITE_URL         https://kmbim.com.br
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm prontas no ambiente.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const dataHora = (iso: string) => new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(iso));

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

async function enviarEmail(para: string, assunto: string, html: string) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('EMAIL_REMETENTE'), to: [para], reply_to: Deno.env.get('EMAIL_RESPOSTA'), subject: assunto, html,
    }),
  });
  if (!resp.ok) throw new Error(`Resend ${resp.status}: ${await resp.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ erro: 'Método não permitido' }, 405);

  let d: Record<string, unknown>;
  try { d = await req.json(); } catch { return json({ erro: 'Dados inválidos' }, 400); }
  const txt = (k: string, max: number) => String(d[k] ?? '').trim().slice(0, max);
  const slug = txt('evento', 120);
  const nome = txt('nome', 120);
  const email = txt('email', 200).toLowerCase();
  const telefone = txt('telefone', 40);
  const empresa = txt('empresa', 160);

  // Campo isca: preenchido só por robôs. Responde "ok" sem fazer nada.
  if (txt('site', 200)) return json({ ok: true });
  if (nome.length < 3 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || telefone.replace(/\D/g, '').length < 8 || d.consentimento !== true) {
    return json({ erro: 'Preencha nome, e-mail e telefone válidos e aceite o aviso de privacidade.' }, 400);
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: ev } = await db.from('eventos')
    .select('id, slug, titulo, inicio, fim, vagas, inscricoes_abertas, inscricoes_ate, ativo')
    .eq('slug', slug).maybeSingle();
  if (!ev || !ev.ativo) return json({ erro: 'Evento não encontrado.' }, 404);
  const limite = new Date(ev.inscricoes_ate ?? ev.inicio);
  if (!ev.inscricoes_abertas || Date.now() > limite.getTime()) return json({ erro: 'As inscrições para este evento estão encerradas.', motivo: 'encerrado' }, 409);
  const { data: restantes } = await db.rpc('vagas_restantes', { p_evento: ev.id });
  if (restantes === 0) return json({ erro: 'As vagas deste evento estão esgotadas.', motivo: 'lotado' }, 409);

  // Mesmo e-mail no mesmo evento: reaproveita a inscrição existente.
  const { data: existente } = await db.from('inscricoes_evento')
    .select('id, status, token').eq('evento_id', ev.id).eq('email', email).maybeSingle(); // e-mails são gravados em minúsculas
  let token: string;
  if (existente?.status === 'confirmada') {
    return json({ ok: true, situacao: 'ja_confirmada' });
  } else if (existente) {
    const { data, error } = await db.from('inscricoes_evento')
      .update({ nome, telefone, empresa, status: 'pendente', cancelado_em: null, token: crypto.randomUUID() })
      .eq('id', existente.id).select('token').single();
    if (error) return json({ erro: 'Não foi possível registrar a inscrição.' }, 500);
    token = data.token;
  } else {
    const { data, error } = await db.from('inscricoes_evento')
      .insert({ evento_id: ev.id, nome, email, telefone, empresa, consentimento: true })
      .select('token').single();
    if (error) return json({ erro: 'Não foi possível registrar a inscrição.' }, 500);
    token = data.token;
  }

  const site = Deno.env.get('SITE_URL') ?? 'https://kmbim.com.br';
  const link = `${site}/eventos/confirmar?token=${token}`;
  const corpo = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Olá, ${esc(nome.split(' ')[0])}!</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Recebemos sua inscrição em <strong>${esc(ev.titulo)}</strong>, ${esc(dataHora(ev.inicio))}.</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6">Para garantir sua vaga, confirme a inscrição:</p>
    <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#F2A33A;color:#1C2A31;font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:6px">Confirmar inscrição</a></p>
    <p style="margin:0 0 8px;font-size:13px;color:#56666D">Depois de confirmar, você recebe o link de acesso e o convite para a agenda.</p>
    <p style="margin:0 0 8px;font-size:13px;color:#56666D">Se não foi você, ignore esta mensagem.</p>`;
  try {
    await enviarEmail(email, `Confirme sua inscrição: ${ev.titulo}`, emailHtml('Confirme sua inscrição', corpo));
  } catch (e) {
    console.error(e);
    return json({ erro: 'Inscrição registrada, mas não conseguimos enviar o e-mail. Tente novamente em alguns minutos.' }, 502);
  }
  return json({ ok: true, situacao: 'pendente' });
});
