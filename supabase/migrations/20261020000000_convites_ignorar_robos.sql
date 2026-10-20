-- KM BIM · Convites: não contar como "abriu o link" a abertura feita por robôs logo após o envio (até 2 minutos).
-- O LinkedIn (e alguns filtros de e-mail) abrem o link sozinhos, segundos ou poucos minutos depois de a mensagem ser enviada.
-- Abertura a menos de 2 minutos do envio (mensagem copiada/WhatsApp, convite ou lembrete por e-mail) é ignorada;
-- a abertura feita depois pela pessoa conta normalmente.
-- Rodar no Supabase: SQL Editor > New query > colar e executar (uma vez), depois da migration de convites.

create or replace function public.abrir_convite(p_token uuid, p_evento uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.convidados;
begin
  select * into v from public.convidados where token = p_token and evento_id = p_evento;
  if not found then return null; end if;
  if v.link_aberto_em is null
     and not exists (
       select 1 from unnest(array[v.whatsapp_enviado_em, v.email_enviado_em, v.lembrete_enviado_em]) as envio(em)
       where envio.em is not null and abs(extract(epoch from now() - envio.em)) < 120
     ) then
    update public.convidados set link_aberto_em = now() where id = v.id;
  end if;
  return json_build_object('nome', v.nome, 'email', v.email, 'telefone', v.telefone);
end;
$$;
grant execute on function public.abrir_convite(uuid, uuid) to anon, authenticated;

-- Limpa as aberturas já registradas que aconteceram a menos de 2 minutos de um envio.
update public.convidados c
  set link_aberto_em = null
  where c.link_aberto_em is not null
    and exists (
      select 1 from unnest(array[c.whatsapp_enviado_em, c.email_enviado_em, c.lembrete_enviado_em]) as envio(em)
      where envio.em is not null and abs(extract(epoch from c.link_aberto_em - envio.em)) < 120
    );
