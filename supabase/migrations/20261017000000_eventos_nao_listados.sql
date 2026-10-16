-- KM BIM · Eventos não listados.
-- Um evento com "listado" desmarcado continua com página e inscrições, mas não aparece na lista de eventos
-- nem na página inicial, e a página pede aos buscadores para não indexar. Só chega lá quem recebe o link.
-- Rodar no Supabase: SQL Editor > New query > colar e executar (uma vez), depois da migration de eventos.

alter table public.eventos add column if not exists listado boolean not null default true;

-- Coluna pública: o site lê no build para decidir onde o evento aparece.
grant select (listado) on public.eventos to anon;
