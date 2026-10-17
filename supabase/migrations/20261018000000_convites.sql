-- KM BIM · Convites individuais para eventos.
-- Lista de convidados por evento (importada no painel, aba Convites), com link pessoal de inscrição,
-- envio do convite por e-mail (Edge Function "convites", via Resend), acompanhamento da entrega
-- (webhook do Resend) e marcação do envio por WhatsApp. Só o administrador acessa.
-- Rodar no Supabase: SQL Editor > New query > colar e executar (uma vez), depois das migrations de eventos.

-- Textos do convite, por evento. Privados: o papel anon só lê as colunas públicas listadas no GRANT de eventos.
alter table public.eventos
  add column if not exists convite_assunto text not null default '',
  add column if not exists convite_texto text not null default '',
  add column if not exists convite_whatsapp text not null default '';

create table if not exists public.convidados (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 120),
  email text not null default '' check (email = '' or (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200)),
  telefone text not null default '' check (char_length(telefone) <= 20),  -- só dígitos, com DDI (55…)
  token uuid not null unique default gen_random_uuid(),                     -- vai no link pessoal: /eventos/{slug}?c={token}
  -- E-mail: pendente → enviado → entregue → aberto → clicou; ou devolvido (endereço inválido), spam, erro
  email_status text not null default 'pendente'
    check (email_status in ('pendente', 'enviado', 'entregue', 'aberto', 'clicou', 'devolvido', 'spam', 'erro')),
  email_id text,                 -- id do convite no Resend (o webhook usa para atualizar o status)
  email_enviado_em timestamptz,
  email_erro text not null default '',
  lembrete_id text,
  lembrete_enviado_em timestamptz,
  whatsapp_enviado_em timestamptz,
  link_aberto_em timestamptz,    -- primeira vez que a pessoa abriu o link pessoal
  criado_em timestamptz not null default now()
);
create unique index if not exists convidados_email_unico on public.convidados (evento_id, lower(email)) where email <> '';
create unique index if not exists convidados_telefone_unico on public.convidados (evento_id, telefone) where telefone <> '';
create index if not exists convidados_evento_idx on public.convidados (evento_id);
create index if not exists convidados_email_id_idx on public.convidados (email_id);
create index if not exists convidados_lembrete_id_idx on public.convidados (lembrete_id);

alter table public.convidados enable row level security;
drop policy if exists "admin gerencia" on public.convidados;
create policy "admin gerencia" on public.convidados
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Inscrição feita pelo link pessoal: liga ao convidado (mesmo que a pessoa use outro e-mail).
alter table public.inscricoes_evento
  add column if not exists convidado_id uuid references public.convidados (id) on delete set null;

-- Chamada pela página do evento quando alguém abre o link pessoal: registra a abertura e devolve
-- os dados do convidado para preencher o formulário. Só funciona com o token certo e o evento certo.
create or replace function public.abrir_convite(p_token uuid, p_evento uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.convidados;
begin
  update public.convidados
    set link_aberto_em = coalesce(link_aberto_em, now())
    where token = p_token and evento_id = p_evento
    returning * into v;
  if not found then return null; end if;
  return json_build_object('nome', v.nome, 'email', v.email, 'telefone', v.telefone);
end;
$$;
grant execute on function public.abrir_convite(uuid, uuid) to anon, authenticated;
