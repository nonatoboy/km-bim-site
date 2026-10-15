-- KM BIM · Eventos (webinars, treinamentos, rodas de conversa…) e inscrições com confirmação por e-mail.
-- Rodar no Supabase: SQL Editor > New query > colar e executar (uma vez).

create type public.tipo_evento as enum ('webinar', 'treinamento', 'roda_conversa', 'workshop', 'outro');
create type public.modalidade_evento as enum ('online', 'presencial', 'hibrido');
-- aguardando_pagamento fica reservado para eventos pagos (integração de pagamento futura)
create type public.status_inscricao as enum ('pendente', 'confirmada', 'aguardando_pagamento', 'cancelada');

-- ---------------------------------------------------------------------------
-- Eventos
-- ---------------------------------------------------------------------------
create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$' and slug <> 'confirmar'), -- /eventos/confirmar é reservado
  titulo text not null,
  tipo public.tipo_evento not null default 'webinar',
  modalidade public.modalidade_evento not null default 'online',
  resumo text not null default '',
  descricao text not null default '',
  publico_alvo text not null default '',
  palestrante text not null default 'Marcelo Nonato Santos',
  local text not null default 'Microsoft Teams',
  inicio timestamptz not null,
  fim timestamptz not null,
  vagas int check (vagas is null or vagas > 0),            -- vazio = sem limite
  inscricoes_abertas boolean not null default true,
  inscricoes_ate timestamptz,                               -- vazio = até o início do evento
  preco numeric(10, 2) check (preco is null or preco >= 0), -- vazio ou 0 = gratuito
  imagem text not null default '',
  solucao_relacionada text not null default '',
  -- Dados privados: só o painel e as funções de e-mail leem (ver permissões abaixo)
  link_acesso text not null default '',
  instrucoes_acesso text not null default '',
  ordem int not null default 0,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now(),
  check (fim > inicio)
);

alter table public.eventos enable row level security;
create trigger eventos_atualizado_em before update on public.eventos
  for each row execute function public.tocar_atualizado_em();
create policy "admin gerencia" on public.eventos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "leitura pública" on public.eventos
  for select to anon, authenticated using (ativo);

-- Visitantes leem só as colunas públicas: link_acesso e instrucoes_acesso ficam de fora.
revoke select on public.eventos from anon;
grant select (id, slug, titulo, tipo, modalidade, resumo, descricao, publico_alvo, palestrante, local,
  inicio, fim, vagas, inscricoes_abertas, inscricoes_ate, preco, imagem, solucao_relacionada, ordem, ativo)
  on public.eventos to anon;

-- ---------------------------------------------------------------------------
-- Inscrições
-- ---------------------------------------------------------------------------
create table public.inscricoes_evento (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos (id) on delete cascade,
  nome text not null check (char_length(nome) between 3 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  telefone text not null check (char_length(telefone) between 8 and 40),
  empresa text not null default '' check (char_length(empresa) <= 160),
  consentimento boolean not null check (consentimento),
  status public.status_inscricao not null default 'pendente',
  token uuid not null unique default gen_random_uuid(),     -- usado nos links de confirmação e cancelamento
  presente boolean not null default false,
  valor numeric(10, 2),                                     -- reservado para eventos pagos
  criado_em timestamptz not null default now(),
  confirmado_em timestamptz,
  cancelado_em timestamptz
);
create unique index inscricoes_evento_email_unico on public.inscricoes_evento (evento_id, lower(email));
create index inscricoes_evento_evento_idx on public.inscricoes_evento (evento_id, status);

-- Visitantes não acessam a tabela: inscrição e confirmação passam pelas Edge Functions.
alter table public.inscricoes_evento enable row level security;
create policy "admin gerencia" on public.inscricoes_evento
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Funções
-- ---------------------------------------------------------------------------

-- Vagas restantes (null = sem limite). Pública, para a página do evento.
create or replace function public.vagas_restantes(p_evento uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case when e.vagas is null then null
              else greatest(e.vagas - (select count(*) from public.inscricoes_evento i
                                       where i.evento_id = e.id and i.status = 'confirmada'), 0)::int
         end
  from public.eventos e
  where e.id = p_evento and e.ativo;
$$;
grant execute on function public.vagas_restantes(uuid) to anon, authenticated;

-- Confirma uma inscrição de forma atômica (trava o evento para não ultrapassar as vagas).
-- Usada só pela Edge Function (service role). Retorna: confirmada | ja_confirmada | lotado | cancelada | invalido
create or replace function public.confirmar_inscricao(p_token uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_insc public.inscricoes_evento;
  v_vagas int;
  v_confirmadas int;
begin
  select * into v_insc from public.inscricoes_evento where token = p_token;
  if not found then return 'invalido'; end if;
  if v_insc.status = 'confirmada' then return 'ja_confirmada'; end if;
  if v_insc.status = 'cancelada' then return 'cancelada'; end if;

  select vagas into v_vagas from public.eventos where id = v_insc.evento_id for update;
  if v_vagas is not null then
    select count(*) into v_confirmadas from public.inscricoes_evento
      where evento_id = v_insc.evento_id and status = 'confirmada';
    if v_confirmadas >= v_vagas then return 'lotado'; end if;
  end if;

  update public.inscricoes_evento
    set status = 'confirmada', confirmado_em = now()
    where id = v_insc.id;
  return 'confirmada';
end;
$$;
revoke execute on function public.confirmar_inscricao(uuid) from public, anon, authenticated;
grant execute on function public.confirmar_inscricao(uuid) to service_role;
