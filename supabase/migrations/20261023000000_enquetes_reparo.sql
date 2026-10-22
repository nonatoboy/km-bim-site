-- KM BIM · Enquetes ao vivo: reparo da migration 20261022000000_enquetes.sql.
-- Para quem aplicou aquela migration só em parte (tabelas criadas, mas sem as regras de acesso e as funções;
-- sintoma: "new row violates row-level security policy for table enquetes" ao criar uma enquete).
-- Pode ser rodada em qualquer situação, inclusive com a migration original completa: cria só o que falta,
-- não apaga tabelas nem respostas.
-- Rodar no Supabase: SQL Editor > New query > colar TODO o conteúdo (sem selecionar trechos) e executar.

do $$ begin
  create type public.tipo_enquete as enum ('escolha_unica', 'escolha_multipla', 'nuvem_palavras');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.estado_pergunta as enum ('aguardando', 'aberta', 'encerrada');
exception when duplicate_object then null; end $$;

create or replace function public.gerar_codigo_enquete()
returns text
language plpgsql
as $$
declare
  v text;
begin
  for i in 1..200 loop
    v := (1000 + floor(random() * 9000))::int::text;
    if not exists (select 1 from public.enquetes where codigo = v) then return v; end if;
  end loop;
  raise exception 'Não há código de enquete livre. Exclua enquetes antigas.';
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabelas (iguais às da migration original)
-- ---------------------------------------------------------------------------
create table if not exists public.enquetes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 160),
  tipo public.tipo_enquete not null default 'escolha_unica',
  codigo text not null unique check (codigo ~ '^[0-9]{4}$'),
  token_projecao uuid not null unique default gen_random_uuid(),
  evento_id uuid references public.eventos (id) on delete set null,
  max_escolhas int check (max_escolhas is null or max_escolhas >= 1),
  max_palavras int not null default 3 check (max_palavras between 1 and 10),
  aberta boolean not null default false,
  pergunta_atual_id uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.enquetes alter column codigo set default public.gerar_codigo_enquete();

create table if not exists public.perguntas_enquete (
  id uuid primary key default gen_random_uuid(),
  enquete_id uuid not null references public.enquetes (id) on delete cascade,
  ordem int not null default 0,
  texto text not null check (char_length(texto) between 1 and 300),
  opcoes text[] not null default '{}' check (cardinality(opcoes) <= 10),
  estado public.estado_pergunta not null default 'aguardando',
  resultado_liberado boolean not null default false,
  palavras_ocultas text[] not null default '{}',
  criado_em timestamptz not null default now()
);
create index if not exists perguntas_enquete_enquete_idx on public.perguntas_enquete (enquete_id, ordem);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'enquetes_pergunta_atual_fk') then
    alter table public.enquetes
      add constraint enquetes_pergunta_atual_fk foreign key (pergunta_atual_id)
      references public.perguntas_enquete (id) on delete set null;
  end if;
end $$;

create table if not exists public.respostas_enquete (
  id uuid primary key default gen_random_uuid(),
  pergunta_id uuid not null references public.perguntas_enquete (id) on delete cascade,
  participante uuid not null,
  escolhas smallint[] not null default '{}',
  palavras text[] not null default '{}',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (pergunta_id, participante)
);

drop trigger if exists enquetes_atualizado_em on public.enquetes;
create trigger enquetes_atualizado_em before update on public.enquetes
  for each row execute function public.tocar_atualizado_em();

-- Regras de acesso: só o administrador lê e grava as tabelas
alter table public.enquetes enable row level security;
alter table public.perguntas_enquete enable row level security;
alter table public.respostas_enquete enable row level security;
drop policy if exists "admin gerencia" on public.enquetes;
drop policy if exists "admin gerencia" on public.perguntas_enquete;
drop policy if exists "admin gerencia" on public.respostas_enquete;
create policy "admin gerencia" on public.enquetes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin gerencia" on public.perguntas_enquete
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin gerencia" on public.respostas_enquete
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Funções internas
-- ---------------------------------------------------------------------------
-- Resultado agregado de uma pergunta. Escolhas: votos por opção, na ordem das opções.
-- Nuvem: palavras e contagem, da mais citada para a menos; p_ocultas inclui as ocultadas (só o painel).
create or replace function public._resultado_pergunta(p_pergunta uuid, p_ocultas boolean default false)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'respondentes', (select count(*) from respostas_enquete r where r.pergunta_id = p.id),
    'votos', (
      select coalesce(json_agg(coalesce(c.n, 0) order by i), '[]'::json)
      from generate_series(0, cardinality(p.opcoes) - 1) i
      left join (
        select e as indice, count(*) as n
        from respostas_enquete r, unnest(r.escolhas) e
        where r.pergunta_id = p.id group by e
      ) c on c.indice = i
    ),
    'palavras', (
      select coalesce(json_agg(json_build_object('palavra', w.palavra, 'n', w.n, 'oculta', w.oculta)
                               order by w.n desc, w.palavra), '[]'::json)
      from (
        select x as palavra, count(*) as n, x = any (p.palavras_ocultas) as oculta
        from respostas_enquete r, unnest(r.palavras) x
        where r.pergunta_id = p.id
        group by x
        having p_ocultas or not (x = any (p.palavras_ocultas))
        order by count(*) desc, x
        limit 80
      ) w
    )
  )
  from perguntas_enquete p
  where p.id = p_pergunta;
$$;

-- Pergunta na tela, com posição na enquete; resultado só quando p_resultado.
create or replace function public._pergunta_publica(p_pergunta uuid, p_resultado boolean)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'id', p.id, 'texto', p.texto, 'opcoes', p.opcoes, 'estado', p.estado,
    'resultado_liberado', p.resultado_liberado,
    'numero', (select count(*) from perguntas_enquete o
               where o.enquete_id = p.enquete_id and (o.ordem, o.criado_em) <= (p.ordem, p.criado_em)),
    'total', (select count(*) from perguntas_enquete o where o.enquete_id = p.enquete_id),
    'resultado', case when p_resultado then public._resultado_pergunta(p.id) end
  )
  from perguntas_enquete p
  where p.id = p_pergunta;
$$;

-- Avisa os celulares (canal público "enquete:{código}" do Supabase Realtime) que algo mudou;
-- eles então consultam entrar_enquete. Uma mensagem por comando do palestrante.
-- Falha no Realtime não impede o comando: os celulares também consultam periodicamente.
create or replace function public._avisar_enquete(p_codigo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(jsonb_build_object('em', now()), 'mudou', 'enquete:' || p_codigo, false);
exception when others then
  null;
end;
$$;

revoke execute on function public._resultado_pergunta(uuid, boolean) from public, anon, authenticated;
revoke execute on function public._pergunta_publica(uuid, boolean) from public, anon, authenticated;
revoke execute on function public._avisar_enquete(text) from public, anon, authenticated;
revoke execute on function public.gerar_codigo_enquete() from public, anon;
grant execute on function public.gerar_codigo_enquete() to authenticated; -- padrão da coluna codigo no insert do painel

-- ---------------------------------------------------------------------------
-- Participante (anon)
-- ---------------------------------------------------------------------------
-- Estado da enquete para o celular: null se o código não existe; {aberta:false} se fechada.
create or replace function public.entrar_enquete(p_codigo text, p_participante uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  e public.enquetes;
  p public.perguntas_enquete;
  r public.respostas_enquete;
begin
  select * into e from enquetes where codigo = p_codigo;
  if not found then return null; end if;
  if not e.aberta then return json_build_object('aberta', false, 'titulo', e.titulo); end if;
  select * into p from perguntas_enquete where id = e.pergunta_atual_id;
  if found then
    select * into r from respostas_enquete where pergunta_id = p.id and participante = p_participante;
  end if;
  return json_build_object(
    'aberta', true, 'titulo', e.titulo, 'tipo', e.tipo,
    'max_escolhas', e.max_escolhas, 'max_palavras', e.max_palavras,
    'pergunta', case when p.id is not null then public._pergunta_publica(p.id, p.resultado_liberado) end,
    'resposta', case when r.id is not null then json_build_object('escolhas', r.escolhas, 'palavras', r.palavras) end
  );
end;
$$;
grant execute on function public.entrar_enquete(text, uuid) to anon, authenticated;

-- Grava ou substitui a resposta do participante à pergunta atual, se ela estiver aberta.
-- Devolve {ok:true} ou {ok:false, erro: fechada | encerrada | invalida}.
create or replace function public.responder_enquete(
  p_codigo text, p_participante uuid, p_pergunta uuid, p_escolhas int[], p_palavras text[]
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.enquetes;
  p public.perguntas_enquete;
  v_escolhas int[] := '{}';
  v_palavras text[] := '{}';
  n int;
begin
  select * into e from enquetes where codigo = p_codigo and aberta;
  if not found then return json_build_object('ok', false, 'erro', 'fechada'); end if;
  select * into p from perguntas_enquete where id = p_pergunta and enquete_id = e.id;
  if not found or p.id is distinct from e.pergunta_atual_id or p.estado <> 'aberta' then
    return json_build_object('ok', false, 'erro', 'encerrada');
  end if;

  if e.tipo = 'nuvem_palavras' then
    if cardinality(p_palavras) > 20 then return json_build_object('ok', false, 'erro', 'invalida'); end if;
    select coalesce(array_agg(distinct w), '{}') into v_palavras
    from (select lower(regexp_replace(btrim(x), '\s+', ' ', 'g')) as w from unnest(coalesce(p_palavras, '{}')) x) t
    where w <> '';
    if cardinality(v_palavras) = 0 or cardinality(v_palavras) > e.max_palavras
       or exists (select 1 from unnest(v_palavras) w where char_length(w) > 25) then
      return json_build_object('ok', false, 'erro', 'invalida');
    end if;
  else
    select coalesce(array_agg(distinct x), '{}') into v_escolhas from unnest(coalesce(p_escolhas, '{}')) x;
    n := cardinality(v_escolhas);
    if n = 0
       or exists (select 1 from unnest(v_escolhas) x where x < 0 or x >= cardinality(p.opcoes))
       or (e.tipo = 'escolha_unica' and n > 1)
       or (e.tipo = 'escolha_multipla' and e.max_escolhas is not null and n > e.max_escolhas) then
      return json_build_object('ok', false, 'erro', 'invalida');
    end if;
  end if;

  insert into respostas_enquete (pergunta_id, participante, escolhas, palavras)
  values (p.id, p_participante, v_escolhas::smallint[], v_palavras)
  on conflict (pergunta_id, participante)
  do update set escolhas = excluded.escolhas, palavras = excluded.palavras, atualizado_em = now();
  return json_build_object('ok', true);
end;
$$;
grant execute on function public.responder_enquete(text, uuid, uuid, int[], text[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Projeção (link secreto, sem login)
-- ---------------------------------------------------------------------------
create or replace function public.projecao_enquete(p_token uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'titulo', e.titulo, 'tipo', e.tipo, 'codigo', e.codigo, 'aberta', e.aberta,
    'pergunta', case when e.pergunta_atual_id is not null then public._pergunta_publica(e.pergunta_atual_id, true) end
  )
  from enquetes e
  where e.token_projecao = p_token;
$$;
grant execute on function public.projecao_enquete(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Painel (só administrador)
-- ---------------------------------------------------------------------------
-- Comandos do palestrante. Cada chamada termina com um único aviso aos celulares.
--   abrir / fechar           aceitar ou não participantes pelo código
--   mostrar (p_pergunta)     põe a pergunta na tela; a anterior, se aberta, é encerrada
--   encerrar / reabrir       para de aceitar / volta a aceitar respostas na pergunta atual
--   liberar_resultado / ocultar_resultado   resultado da pergunta atual nos celulares
--   limpar_tela              tira a pergunta da tela (projeção volta ao QR code)
--   reiniciar                apaga todas as respostas e volta todas as perguntas para "aguardando"
create or replace function public.controlar_enquete(p_enquete uuid, p_acao text, p_pergunta uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.enquetes;
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;
  select * into e from enquetes where id = p_enquete for update;
  if not found then raise exception 'Enquete não encontrada'; end if;

  case p_acao
    when 'abrir' then update enquetes set aberta = true where id = e.id;
    when 'fechar' then update enquetes set aberta = false where id = e.id;
    when 'mostrar' then
      if not exists (select 1 from perguntas_enquete where id = p_pergunta and enquete_id = e.id) then
        raise exception 'Pergunta não pertence a esta enquete';
      end if;
      update perguntas_enquete set estado = 'encerrada'
        where id = e.pergunta_atual_id and id <> p_pergunta and estado = 'aberta';
      update perguntas_enquete set estado = 'aberta' where id = p_pergunta and estado = 'aguardando';
      update enquetes set pergunta_atual_id = p_pergunta where id = e.id;
    when 'encerrar' then
      update perguntas_enquete set estado = 'encerrada' where id = e.pergunta_atual_id;
    when 'reabrir' then
      update perguntas_enquete set estado = 'aberta' where id = e.pergunta_atual_id;
    when 'liberar_resultado' then
      update perguntas_enquete set resultado_liberado = true where id = e.pergunta_atual_id;
    when 'ocultar_resultado' then
      update perguntas_enquete set resultado_liberado = false where id = e.pergunta_atual_id;
    when 'limpar_tela' then
      update perguntas_enquete set estado = 'encerrada' where id = e.pergunta_atual_id and estado = 'aberta';
      update enquetes set pergunta_atual_id = null where id = e.id;
    when 'reiniciar' then
      delete from respostas_enquete r using perguntas_enquete p where r.pergunta_id = p.id and p.enquete_id = e.id;
      update perguntas_enquete set estado = 'aguardando', resultado_liberado = false where enquete_id = e.id;
      update enquetes set pergunta_atual_id = null where id = e.id;
    else raise exception 'Ação desconhecida: %', p_acao;
  end case;
  perform public._avisar_enquete(e.codigo);
end;
$$;
revoke execute on function public.controlar_enquete(uuid, text, uuid) from public, anon;
grant execute on function public.controlar_enquete(uuid, text, uuid) to authenticated;

-- Resultado completo para o painel (inclui palavras ocultadas, marcadas como "oculta").
create or replace function public.resultado_pergunta_admin(p_pergunta uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;
  return public._resultado_pergunta(p_pergunta, true);
end;
$$;
revoke execute on function public.resultado_pergunta_admin(uuid) from public, anon;
grant execute on function public.resultado_pergunta_admin(uuid) to authenticated;

-- Cópia da enquete para outra turma: novo código, novo link de projeção, fechada e sem respostas.
create or replace function public.duplicar_enquete(p_enquete uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nova uuid;
begin
  if not public.is_admin() then raise exception 'Apenas administradores'; end if;
  insert into enquetes (titulo, tipo, evento_id, max_escolhas, max_palavras)
    select left(titulo || ' (cópia)', 160), tipo, evento_id, max_escolhas, max_palavras from enquetes where id = p_enquete
    returning id into v_nova;
  if v_nova is null then raise exception 'Enquete não encontrada'; end if;
  insert into perguntas_enquete (enquete_id, ordem, texto, opcoes)
    select v_nova, ordem, texto, opcoes from perguntas_enquete where enquete_id = p_enquete;
  return v_nova;
end;
$$;
revoke execute on function public.duplicar_enquete(uuid) from public, anon;
grant execute on function public.duplicar_enquete(uuid) to authenticated;

-- A API do Supabase relê a estrutura do banco (novas funções e relações)
notify pgrst, 'reload schema';

-- Conferência: deve mostrar 1, 1, 1 e 10
select
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'enquetes') as politicas_enquetes,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'perguntas_enquete') as politicas_perguntas,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'respostas_enquete') as politicas_respostas,
  (select count(*) from information_schema.routines where routine_schema = 'public' and routine_name in (
    'gerar_codigo_enquete', '_resultado_pergunta', '_pergunta_publica', '_avisar_enquete', 'entrar_enquete',
    'responder_enquete', 'projecao_enquete', 'controlar_enquete', 'resultado_pergunta_admin', 'duplicar_enquete'
  )) as funcoes;
