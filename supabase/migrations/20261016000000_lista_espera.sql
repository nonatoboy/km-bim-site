-- KM BIM · Lista de espera dos eventos.
-- Com as vagas preenchidas, a inscrição continua aberta: quem confirma o e-mail entra na lista de espera
-- (posição por ordem de confirmação). Quando uma vaga é liberada, o primeiro da fila é confirmado
-- automaticamente e recebe o e-mail com o link de acesso (feito pela Edge Function "inscricao").
-- Rodar no Supabase: SQL Editor > New query > colar e executar (uma vez), depois da migration de eventos.
--
-- Obs.: o novo valor do enum só pode ser usado depois deste script; por isso as funções abaixo
-- são plpgsql (validadas na execução, não na criação).

alter type public.status_inscricao add value if not exists 'lista_espera' after 'confirmada';

alter table public.inscricoes_evento add column if not exists espera_desde timestamptz; -- entrada na lista de espera

-- Pessoas na lista de espera de um evento. Pública, para a página do evento mostrar a posição prevista.
create or replace function public.lista_espera_total(p_evento uuid)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return (select count(*)::int from public.inscricoes_evento
          where evento_id = p_evento and status::text = 'lista_espera');
end;
$$;
grant execute on function public.lista_espera_total(uuid) to anon, authenticated;

-- Posição de uma inscrição na lista de espera (null se não estiver na lista).
create or replace function public.posicao_espera(p_inscricao uuid)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v public.inscricoes_evento;
begin
  select * into v from public.inscricoes_evento where id = p_inscricao;
  if not found or v.status::text <> 'lista_espera' then return null; end if;
  return (select count(*)::int + 1 from public.inscricoes_evento
          where evento_id = v.evento_id and status::text = 'lista_espera'
            and (espera_desde, id) < (v.espera_desde, v.id));
end;
$$;
revoke execute on function public.posicao_espera(uuid) from public, anon;
grant execute on function public.posicao_espera(uuid) to authenticated, service_role;

-- Confirma uma inscrição (link do e-mail). Se não houver vaga, ou se já houver fila, entra na lista de espera.
-- Retorna: confirmada | lista_espera | ja_confirmada | ja_lista_espera | cancelada | invalido
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
  v_fila int;
begin
  select * into v_insc from public.inscricoes_evento where token = p_token;
  if not found then return 'invalido'; end if;
  if v_insc.status::text = 'confirmada' then return 'ja_confirmada'; end if;
  if v_insc.status::text = 'lista_espera' then return 'ja_lista_espera'; end if;
  if v_insc.status::text = 'cancelada' then return 'cancelada'; end if;

  select vagas into v_vagas from public.eventos where id = v_insc.evento_id for update;
  if v_vagas is not null then
    select count(*) filter (where status::text = 'confirmada'), count(*) filter (where status::text = 'lista_espera')
      into v_confirmadas, v_fila
      from public.inscricoes_evento where evento_id = v_insc.evento_id;
    -- Quem já está na fila tem prioridade: com fila, o novo inscrito entra no fim dela.
    if v_confirmadas >= v_vagas or v_fila > 0 then
      update public.inscricoes_evento
        set status = 'lista_espera'::text::public.status_inscricao, espera_desde = clock_timestamp()
        where id = v_insc.id;
      return 'lista_espera';
    end if;
  end if;

  update public.inscricoes_evento
    set status = 'confirmada', confirmado_em = now()
    where id = v_insc.id;
  return 'confirmada';
end;
$$;
revoke execute on function public.confirmar_inscricao(uuid) from public, anon, authenticated;
grant execute on function public.confirmar_inscricao(uuid) to service_role;

-- Preenche as vagas livres com a lista de espera, por ordem de chegada. Retorna os ids confirmados,
-- para a Edge Function enviar os e-mails. Não promove depois que o evento termina.
create or replace function public.promover_lista_espera(p_evento uuid)
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vagas int;
  v_fim timestamptz;
  v_livres int;
begin
  select vagas, fim into v_vagas, v_fim from public.eventos where id = p_evento for update;
  if not found or v_fim < now() then return; end if;
  if v_vagas is null then
    v_livres := 2147483647; -- sem limite: libera toda a fila
  else
    select v_vagas - count(*) into v_livres from public.inscricoes_evento
      where evento_id = p_evento and status::text = 'confirmada';
  end if;
  if v_livres <= 0 then return; end if;

  return query
    update public.inscricoes_evento i
      set status = 'confirmada', confirmado_em = now()
      where i.id in (select f.id from public.inscricoes_evento f
                     where f.evento_id = p_evento and f.status::text = 'lista_espera'
                     order by f.espera_desde, f.id
                     limit v_livres)
      returning i.id;
end;
$$;
revoke execute on function public.promover_lista_espera(uuid) from public, anon, authenticated;
grant execute on function public.promover_lista_espera(uuid) to service_role;
