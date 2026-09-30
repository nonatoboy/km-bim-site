-- KM BIM · estrutura inicial do banco
-- Rodar no Supabase: SQL Editor > New query > colar e executar (uma vez).

-- ---------------------------------------------------------------------------
-- Administradores: só usuários listados aqui editam conteúdo e leem pedidos.
-- ---------------------------------------------------------------------------
create table public.administradores (
  user_id uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.administradores enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.administradores where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

create policy "admin lê administradores" on public.administradores
  for select to authenticated using (public.is_admin());

-- Atualiza a coluna atualizado_em em qualquer edição.
create or replace function public.tocar_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Conteúdo do site
-- ---------------------------------------------------------------------------
create table public.configuracoes (
  chave text primary key,
  valor text not null default '',
  atualizado_em timestamptz not null default now()
);

create table public.categorias (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  nome text not null,
  descricao text not null default '',
  ordem int not null default 0,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

create type public.modalidade_solucao as enum ('propria', 'parceiro', 'mista');

create table public.solucoes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  titulo text not null,
  resumo text not null default '',
  descricao text not null default '',
  entregaveis text[] not null default '{}',
  publico text not null default '',
  categoria text not null references public.categorias (slug) on update cascade,
  modalidade public.modalidade_solucao not null default 'propria',
  destaque boolean not null default false,
  ordem int not null default 0,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

create table public.parceiros (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text not null default '',
  logo text not null default '',
  site text not null default '',
  -- slugs das soluções em que o parceiro atua
  solucoes text[] not null default '{}',
  ordem int not null default 0,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

create table public.palestras (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  evento text not null default '',
  ano int,
  cidade text not null default '',
  link text not null default '',
  imagem text not null default '',
  ordem int not null default 0,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

create table public.publicacoes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  veiculo text not null default '',
  ano int,
  link text not null default '',
  ordem int not null default 0,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

create table public.reconhecimentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('formacao', 'certificacao', 'atuacao', 'premio')),
  titulo text not null,
  descricao text not null default '',
  ano text not null default '',
  ordem int not null default 0,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

create table public.depoimentos (
  id uuid primary key default gen_random_uuid(),
  autor text not null,
  cargo text not null default '',
  empresa text not null default '',
  texto text not null,
  foto text not null default '',
  -- só aparece no site com autorização registrada do depoente
  autorizado boolean not null default false,
  ordem int not null default 0,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

-- Leitura pública só do que está ativo; escrita só para administradores.
do $$
declare t text;
begin
  foreach t in array array['configuracoes','categorias','solucoes','parceiros','palestras','publicacoes','reconhecimentos','depoimentos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.tocar_atualizado_em()', t || '_atualizado_em', t);
    execute format('create policy "admin gerencia" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

create policy "leitura pública" on public.configuracoes for select to anon, authenticated using (true);
create policy "leitura pública" on public.categorias for select to anon, authenticated using (ativo);
create policy "leitura pública" on public.solucoes for select to anon, authenticated using (ativo);
create policy "leitura pública" on public.parceiros for select to anon, authenticated using (ativo);
create policy "leitura pública" on public.palestras for select to anon, authenticated using (ativo);
create policy "leitura pública" on public.publicacoes for select to anon, authenticated using (ativo);
create policy "leitura pública" on public.reconhecimentos for select to anon, authenticated using (ativo);
create policy "leitura pública" on public.depoimentos for select to anon, authenticated using (ativo and autorizado);

-- ---------------------------------------------------------------------------
-- Pedidos de orçamento (formulário do site)
-- ---------------------------------------------------------------------------
create type public.status_pedido as enum ('novo', 'em_analise', 'respondido', 'arquivado');

create table public.pedidos_orcamento (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  nome text not null check (char_length(nome) between 2 and 120),
  empresa text not null check (char_length(empresa) between 1 and 160),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  telefone text not null default '' check (char_length(telefone) <= 40),
  segmento text not null default '' check (char_length(segmento) <= 80),
  porte text not null default '' check (char_length(porte) <= 80),
  cidade_uf text not null default '' check (char_length(cidade_uf) <= 120),
  fase text not null default '' check (char_length(fase) <= 80),
  mensagem text not null default '' check (char_length(mensagem) <= 4000),
  -- [{ "slug": "...", "titulo": "..." }]
  solucoes jsonb not null default '[]' check (jsonb_typeof(solucoes) = 'array' and jsonb_array_length(solucoes) <= 30),
  consentimento boolean not null check (consentimento),
  status public.status_pedido not null default 'novo',
  notas_internas text not null default ''
);
alter table public.pedidos_orcamento enable row level security;

-- Visitantes só inserem (não leem nada); status e notas nascem com o padrão.
create policy "visitante envia pedido" on public.pedidos_orcamento
  for insert to anon, authenticated
  with check (status = 'novo' and notas_internas = '');
create policy "admin gerencia pedidos" on public.pedidos_orcamento
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create index pedidos_orcamento_criado_em_idx on public.pedidos_orcamento (criado_em desc);

-- ---------------------------------------------------------------------------
-- Storage: imagens do site (logos de parceiros, fotos de palestras etc.)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('midia', 'midia', true)
on conflict (id) do nothing;

create policy "admin envia mídia" on storage.objects
  for insert to authenticated with check (bucket_id = 'midia' and public.is_admin());
create policy "admin altera mídia" on storage.objects
  for update to authenticated using (bucket_id = 'midia' and public.is_admin());
create policy "admin apaga mídia" on storage.objects
  for delete to authenticated using (bucket_id = 'midia' and public.is_admin());
