// Edge Function "publicar": dispara o GitHub Actions que gera o site e envia para a Hostinger.
// Só administradores (tabela public.administradores) podem acioná-la.
//
// Segredos necessários (Supabase > Edge Functions > Secrets):
//   GITHUB_TOKEN  token fine-grained com permissão "Contents: Read and write" no repositório
//   GITHUB_REPO   nonatoboy/km-bim-site
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ erro: 'Método não permitido' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: admin, error } = await db.rpc('is_admin');
  if (error || !admin) return json({ erro: 'Sem permissão' }, 403);

  const resp = await fetch(`https://api.github.com/repos/${Deno.env.get('GITHUB_REPO')}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('GITHUB_TOKEN')}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'kmbim-publicar',
    },
    body: JSON.stringify({ event_type: 'publicar' }),
  });
  if (!resp.ok) return json({ erro: `GitHub respondeu ${resp.status}` }, 502);
  return json({ ok: true });
});
